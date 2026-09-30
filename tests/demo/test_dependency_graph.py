from construction_reconciliation.demo.dependency_graph import analyze_dependency_graph
from construction_reconciliation.demo.importer import import_xer
from construction_reconciliation.demo.models import Activity, Schedule


def _schedule(*activities: Activity) -> Schedule:
    return Schedule(activities=list(activities), source_format="csv")


def test_dependency_graph_has_prerequisite_to_dependent_edges_and_order():
    schedule = _schedule(
        Activity(id="A", name="Excavate"),
        Activity(id="B", name="Pour", predecessors=["A"]),
        Activity(id="C", name="Cure", predecessors=["B"]),
    )

    result = analyze_dependency_graph(schedule)

    assert [(edge.predecessor_id, edge.successor_id) for edge in result.edges] == [
        ("A", "B"), ("B", "C")
    ]
    assert result.topological_order == ["A", "B", "C"]
    assert result.is_acyclic and result.is_consistent


def test_missing_predecessor_is_returned_as_unresolved_edge():
    result = analyze_dependency_graph(
        _schedule(Activity(id="B", name="Pour", predecessors=["MISSING"]))
    )

    assert result.edges[0].resolved is False
    assert result.issues[0].code == "MISSING_PREDECESSOR"
    assert not result.is_consistent


def test_self_dependency_and_multi_activity_cycle_are_reported():
    schedule = _schedule(
        Activity(id="A", name="A", predecessors=["A", "B"]),
        Activity(id="B", name="B", predecessors=["A"]),
    )

    result = analyze_dependency_graph(schedule)

    assert {issue.code for issue in result.issues} == {
        "SELF_DEPENDENCY", "DEPENDENCY_CYCLE"
    }
    assert result.is_acyclic is False
    assert result.topological_order == []


def test_predecessor_finish_after_successor_start_is_a_warning():
    schedule = _schedule(
        Activity(id="A", name="Predecessor", planned_finish="2026-09-12"),
        Activity(id="B", name="Successor", planned_start="2026-09-11", predecessors=["A"]),
    )

    result = analyze_dependency_graph(schedule)

    assert result.issues[0].code == "PREDECESSOR_DATE_OVERLAP"
    assert result.issues[0].severity == "WARNING"


def test_xer_missing_predecessor_is_not_silently_dropped():
    content = (
        "%T\tTASK\n"
        "%F\ttask_id\ttask_code\ttask_name\n"
        "%R\t2\tB\tPour foundation\n"
        "%T\tTASKPRED\n"
        "%F\ttask_id\tpred_task_id\tpred_type\n"
        "%R\t2\t404\tPR_FS\n"
    )

    result = analyze_dependency_graph(import_xer(content))

    assert any(issue.code == "MISSING_PREDECESSOR" for issue in result.issues)
    assert any(edge.predecessor_id == "404" and not edge.resolved for edge in result.edges)


def test_xer_missing_successor_is_reported():
    content = (
        "%T\tTASK\n"
        "%F\ttask_id\ttask_code\ttask_name\n"
        "%R\t1\tA\tExcavate\n"
        "%T\tTASKPRED\n"
        "%F\ttask_id\tpred_task_id\tpred_type\n"
        "%R\t999\t1\tPR_FS\n"
    )

    result = analyze_dependency_graph(import_xer(content))

    assert any(issue.code == "MISSING_SUCCESSOR" for issue in result.issues)
