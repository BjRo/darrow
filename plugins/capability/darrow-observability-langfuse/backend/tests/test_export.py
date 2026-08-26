from __future__ import annotations

import unittest
from contextlib import contextmanager
from pathlib import Path

from langfuse import Langfuse
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.export import export_document
from darrow_observability_langfuse.rollout import trace_document


PLUGIN_DIR = Path(__file__).resolve().parents[2]
ROLLOUT = PLUGIN_DIR / "tests" / "fixtures" / "main-rollout.jsonl"


class CollectingSpanExporter(SpanExporter):
    def __init__(self):
        self.spans = []

    def export(self, spans):
        self.spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self):
        pass


class FakeObservation:
    def __init__(self, attributes: dict):
        self.attributes = attributes
        self.children: list[FakeObservation] = []
        self.ended = False

    def start_observation(self, **attributes):
        child = FakeObservation(attributes)
        self.children.append(child)
        return child

    def end(self, **_attributes):
        self.ended = True


class FakeClient:
    def __init__(self):
        self.roots: list[FakeObservation] = []
        self.flushed = False

    def start_observation(self, **attributes):
        root = FakeObservation(attributes)
        self.roots.append(root)
        return root

    @contextmanager
    def start_as_current_observation(self, **attributes):
        root = self.start_observation(**attributes)
        try:
            yield root
        finally:
            root.end()

    def flush(self):
        self.flushed = True


class ExportDocumentTest(unittest.TestCase):
    def _exported_spans(self, *, public_key, work_item_id=None):
        config = Config(
            enabled=True,
            capture_content=False,
            public_key=public_key,
            secret_key="sk-test",
            base_url="http://langfuse.example",
            work_item_id=work_item_id,
        )
        document = trace_document(ROLLOUT, config, str(PLUGIN_DIR))
        exporter = CollectingSpanExporter()
        client = Langfuse(
            public_key=config.public_key,
            secret_key=config.secret_key,
            base_url=config.base_url,
            flush_at=1,
            span_exporter=exporter,
        )

        export_document(document, config, client=client)
        return exporter.spans

    def test_associates_session_observations_with_work_item(self):
        spans = self._exported_spans(
            public_key="pk-work-item-test",
            work_item_id="EXT-7",
        )

        self.assertGreater(len(spans), 1)
        self.assertEqual(
            {
                span.attributes.get(
                    "langfuse.trace.metadata.darrow.work_item_id"
                )
                for span in spans
            },
            {"EXT-7"},
        )

    def test_exports_epoch_as_session_and_thread_as_conversation_metadata(self):
        spans = self._exported_spans(
            public_key="pk-session-test",
            work_item_id="EXT-7",
        )

        self.assertGreater(len(spans), 1)
        self.assertEqual(
            {span.attributes.get("session.id") for span in spans},
            {"session-main:attribution:0"},
        )
        self.assertEqual(
            {
                span.attributes.get("langfuse.trace.metadata.codex.thread_id")
                for span in spans
            },
            {"session-main"},
        )
        self.assertEqual(
            {
                span.attributes.get(
                    "langfuse.trace.metadata.darrow.attribution_epoch"
                )
                for span in spans
            },
            {"session-main:attribution:0"},
        )
        self.assertEqual(
            {
                span.attributes.get(
                    "langfuse.trace.metadata.darrow.attribution_source"
                )
                for span in spans
            },
            {"configuration"},
        )

    def test_exports_nested_trace_tree_through_langfuse_client(self):
        config = Config(
            enabled=True,
            capture_content=True,
            public_key="pk-test",
            secret_key="sk-test",
            base_url="http://langfuse.example",
            work_item_id="EXT-7",
        )
        document = trace_document(ROLLOUT, config, str(PLUGIN_DIR))
        client = FakeClient()

        exported = export_document(document, config, client=client)

        self.assertEqual(exported, 1)
        self.assertTrue(client.flushed)
        root = client.roots[0]
        self.assertEqual(root.attributes["name"], "Codex Turn")
        self.assertEqual(root.attributes["as_type"], "agent")
        self.assertEqual(root.attributes["metadata"]["darrow.work_item_id"], "EXT-7")
        generation = next(child for child in root.children if child.attributes["as_type"] == "generation")
        self.assertEqual(generation.attributes["model"], "gpt-5.6-sol")
        self.assertEqual(generation.attributes["usage_details"]["total_tokens"], 120)
        tool = next(child for child in generation.children if child.attributes["as_type"] == "tool")
        self.assertEqual(tool.attributes["name"], "rg --files")
        subagent = next(child for child in root.children if child.attributes["name"] == "Codex Subagent Turn")
        self.assertEqual(subagent.attributes["as_type"], "agent")
        self.assertTrue(root.ended and generation.ended and tool.ended and subagent.ended)


if __name__ == "__main__":
    unittest.main()
