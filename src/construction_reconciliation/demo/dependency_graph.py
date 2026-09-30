"""Build and validate a schedule's predecessor dependency graph.

Edges point from prerequisite to dependent activity. This module does not mutate
the schedule, and callers receive both the graph and any consistency findings.
"""

from __future__ import annotations

from datetime import date
import heapq
from typing import Literal

from pydantic import BaseModel

from construction_reconciliation.demo.models import Schedule


IssueSeverity = Literal["ERROR", "WARNING"]


class DependencyNode(BaseModel):
    activity_id: str
    activity_name: str
    predecessor_ids: list[str]
    successor_ids: list[str]


class DependencyEdge(BaseModel):
    predecessor_id: str
    successor_id: str
    resolved: bool


class DependencyIssue(BaseModel):
    code: str
    severity: IssueSeverity
    message: str
    activity_ids: list[str]


class DependencyGraphReport(BaseModel):
    node_count: int
    edge_count: int
    nodes: list[DependencyNode]
    edges: list[DependencyEdge]
    topological_order: list[str]
    issues: list[DependencyIssue]
    is_acyclic: bool
    is_consistent: bool


def _cycle_components(
    node_ids: list[str], successors: dict[str, set[str]], predecessors: dict[str, set[str]]
) -> list[list[str]]:
    """Return strongly connected components containing a dependency cycle."""
    visited: set[str] = set()
    finish_order: list[str] = []

    for root in node_ids:
        if root in visited:
            continue
        stack: list[tuple[str, bool]] = [(root, False)]
        while stack:
            current, expanded = stack.pop()
            if expanded:
                finish_order.append(current)
                continue
            if current in visited:
                continue
            visited.add(current)
            stack.append((current, True))
            for child in sorted(successors[current], reverse=True):
                if child not in visited:
                    stack.append((child, False))

    visited.clear()
    components: list[list[str]] = []
    for root in reversed(finish_order):
        if root in visited:
            continue
        component: list[str] = []
        stack = [root]
        visited.add(root)
        while stack:
            current = stack.pop()
            component.append(current)
            for parent in sorted(predecessors[current], reverse=True):
                if parent not in visited:
                    visited.add(parent)
                    stack.append(parent)
        if len(component) > 1 or root in successors[root]:
            components.append(sorted(component))
    return sorted(components)


def analyze_dependency_graph(schedule: Schedule) -> DependencyGraphReport:
    """Create a directed graph and identify unresolved or inconsistent links.

    Schedule predecessor references are interpreted as finish-to-start links
    when checking dates. Since the demo importer does not preserve relationship
    types or calendars, date overlap is a warning rather than a hard failure.
    """
    activities = schedule.activities
    first_by_id = {}
    duplicate_ids: set[str] = set()
    for activity in activities:
        if activity.id in first_by_id:
            duplicate_ids.add(activity.id)
        else:
            first_by_id[activity.id] = activity

    node_ids = sorted(first_by_id)
    known_ids = set(first_by_id)
    successors: dict[str, set[str]] = {activity_id: set() for activity_id in node_ids}
    predecessors: dict[str, set[str]] = {activity_id: set() for activity_id in node_ids}
    node_predecessors: dict[str, set[str]] = {activity_id: set() for activity_id in node_ids}
    node_successors: dict[str, set[str]] = {activity_id: set() for activity_id in node_ids}
    edges: list[DependencyEdge] = []
    issues: list[DependencyIssue] = []
    unique_edge_pairs: set[tuple[str, str]] = set()

    for activity_id in sorted(duplicate_ids):
        issues.append(DependencyIssue(
            code="DUPLICATE_ACTIVITY_ID",
            severity="ERROR",
            message=f"Activity ID '{activity_id}' occurs more than once; its dependencies are ambiguous.",
            activity_ids=[activity_id],
        ))

    for activity in activities:
        seen_for_activity: set[str] = set()
        for predecessor_id in activity.predecessors:
            pair = (predecessor_id, activity.id)
            if predecessor_id in seen_for_activity:
                issues.append(DependencyIssue(
                    code="DUPLICATE_DEPENDENCY",
                    severity="WARNING",
                    message=f"Activity '{activity.id}' lists predecessor '{predecessor_id}' more than once.",
                    activity_ids=[predecessor_id, activity.id],
                ))
                continue
            seen_for_activity.add(predecessor_id)
            if pair not in unique_edge_pairs:
                unique_edge_pairs.add(pair)
                edges.append(DependencyEdge(
                    predecessor_id=predecessor_id,
                    successor_id=activity.id,
                    resolved=predecessor_id in known_ids,
                ))

            node_predecessors[activity.id].add(predecessor_id)
            if predecessor_id not in known_ids:
                issues.append(DependencyIssue(
                    code="MISSING_PREDECESSOR",
                    severity="ERROR",
                    message=f"Activity '{activity.id}' references predecessor '{predecessor_id}', which is absent from the schedule.",
                    activity_ids=[activity.id, predecessor_id],
                ))
                continue
            node_successors[predecessor_id].add(activity.id)
            if predecessor_id == activity.id:
                issues.append(DependencyIssue(
                    code="SELF_DEPENDENCY",
                    severity="ERROR",
                    message=f"Activity '{activity.id}' cannot depend on itself.",
                    activity_ids=[activity.id],
                ))
            successors[predecessor_id].add(activity.id)
            predecessors[activity.id].add(predecessor_id)

            predecessor = first_by_id[predecessor_id]
            if predecessor.planned_finish and activity.planned_start:
                try:
                    predecessor_finish = date.fromisoformat(predecessor.planned_finish[:10])
                    successor_start = date.fromisoformat(activity.planned_start[:10])
                except ValueError:
                    issues.append(DependencyIssue(
                        code="INVALID_PLANNED_DATE",
                        severity="ERROR",
                        message=(
                            f"A planned date on predecessor '{predecessor_id}' or "
                            f"dependent activity '{activity.id}' is invalid."
                        ),
                        activity_ids=[predecessor_id, activity.id],
                    ))
                    continue
                if predecessor_finish > successor_start:
                    issues.append(DependencyIssue(
                        code="PREDECESSOR_DATE_OVERLAP",
                        severity="WARNING",
                        message=(
                            f"Predecessor '{predecessor_id}' finishes after dependent "
                            f"activity '{activity.id}' starts; this may violate a "
                            "finish-to-start dependency."
                        ),
                        activity_ids=[predecessor_id, activity.id],
                    ))

    for predecessor_id, successor_id in schedule.unresolved_dependency_edges:
        pair = (predecessor_id, successor_id)
        if pair not in unique_edge_pairs:
            unique_edge_pairs.add(pair)
            edges.append(DependencyEdge(
                predecessor_id=predecessor_id,
                successor_id=successor_id,
                resolved=predecessor_id in known_ids and successor_id in known_ids,
            ))
        missing_endpoints = [
            activity_id
            for activity_id in (predecessor_id, successor_id)
            if activity_id not in known_ids
        ]
        for missing_id in missing_endpoints:
            role = "predecessor" if missing_id == predecessor_id else "dependent activity"
            issues.append(DependencyIssue(
                code="MISSING_PREDECESSOR" if role == "predecessor" else "MISSING_SUCCESSOR",
                severity="ERROR",
                message=f"Dependency references {role} '{missing_id}', which is absent from the schedule.",
                activity_ids=[predecessor_id, successor_id],
            ))

    cycle_groups = _cycle_components(node_ids, successors, predecessors)
    for cycle in cycle_groups:
        issues.append(DependencyIssue(
            code="DEPENDENCY_CYCLE",
            severity="ERROR",
            message=f"Dependency cycle detected among activities: {', '.join(cycle)}.",
            activity_ids=cycle,
        ))

    indegree = {activity_id: len(predecessors[activity_id]) for activity_id in node_ids}
    ready = [activity_id for activity_id, degree in indegree.items() if degree == 0]
    heapq.heapify(ready)
    topological_order: list[str] = []
    while ready:
        current = heapq.heappop(ready)
        topological_order.append(current)
        for child in sorted(successors[current]):
            indegree[child] -= 1
            if indegree[child] == 0:
                heapq.heappush(ready, child)

    nodes = [
        DependencyNode(
            activity_id=activity_id,
            activity_name=first_by_id[activity_id].name,
            predecessor_ids=sorted(node_predecessors[activity_id]),
            successor_ids=sorted(node_successors[activity_id]),
        )
        for activity_id in node_ids
    ]
    edges.sort(key=lambda edge: (edge.predecessor_id, edge.successor_id))
    issues.sort(key=lambda issue: (issue.code, issue.activity_ids, issue.message))
    return DependencyGraphReport(
        node_count=len(nodes),
        edge_count=len(edges),
        nodes=nodes,
        edges=edges,
        topological_order=topological_order,
        issues=issues,
        is_acyclic=not cycle_groups,
        is_consistent=not issues,
    )
