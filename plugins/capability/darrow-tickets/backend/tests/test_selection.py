"""The public CLI chooses one adapter before tracker access."""

from dataclasses import dataclass, field

import pytest

from darrow_tickets import selection
from darrow_tickets.arguments import Arguments, parse
from darrow_tickets.cli import main

from .conftest import Backend


@dataclass
class SpyAdapter:
    calls: list[Arguments] = field(default_factory=list)

    def execute(self, args: Arguments) -> None:
        self.calls.append(args)


def test_parser_preserves_provider_owned_reference() -> None:
    args = parse("relate", ["ENG-12", "--depends-on", "ENG-13"])
    assert args.reference == "ENG-12"
    assert args.value("depends-on") == "ENG-13"


def test_explicit_provider_routes_opaque_reference(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    github, linear = SpyAdapter(), SpyAdapter()
    monkeypatch.setattr(selection, "PROVIDERS", {"github": github, "linear": linear})
    assert main(["get", "ENG-12", "--provider", "linear"]) == 0
    assert not github.calls
    assert len(linear.calls) == 1
    assert linear.calls[0].reference == "ENG-12"
    assert "provider" not in linear.calls[0].options


def test_multiple_adapters_require_selection_before_access(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    github, linear = SpyAdapter(), SpyAdapter()
    monkeypatch.setattr(selection, "PROVIDERS", {"github": github, "linear": linear})
    assert main(["get", "123"]) == 3
    assert "provider is ambiguous" in capsys.readouterr().err
    assert not github.calls and not linear.calls


def test_unbundled_provider_never_accesses_github(
    backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["get", "ENG-12", "--provider", "linear"]) == 3
    assert "provider is unavailable: linear" in capsys.readouterr().err
    assert not backend.calls


def test_repeated_provider_option_refused(
    backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["inspect", "--provider", "github", "--provider", "github"]) == 2
    assert "--provider accepts exactly one" in capsys.readouterr().err
    assert not backend.calls
