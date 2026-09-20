"""A repository binds one installation; files are not an engineering ledger."""

from pathlib import Path

from .models import Claim, Grant
from .storage import read_object, write_object


class Installation:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    @property
    def grant(self) -> Grant:
        return Grant.model_validate(read_object(self.root / "grant.json"))

    @property
    def lock(self) -> Path:
        return Path(self.grant.common_git) / "artificer" / "admission.lock"

    def save_grant(self, grant: Grant) -> None:
        write_object(self.root / "grant.json", grant.model_dump())

    def claim_path(self, delivery: str) -> Path:
        from uuid import UUID

        if str(UUID(delivery)) != delivery:
            raise ValueError("Delivery must be its canonical UUID")
        return self.root / "deliveries" / delivery / "claim.json"

    def claim(self, delivery: str) -> Claim:
        claim = Claim.model_validate(read_object(self.claim_path(delivery)))
        if claim.id != delivery or claim.grant != self.grant.id:
            raise ValueError("Delivery correlation does not match this grant")
        return claim

    def claims(self) -> list[Claim]:
        return [
            self.claim(path.parent.name)
            for path in sorted((self.root / "deliveries").glob("*/claim.json"))
        ]

    def save(self, claim: Claim) -> None:
        write_object(self.claim_path(claim.id), claim.model_dump())

    def delivery_dir(self, delivery: str) -> Path:
        return self.claim_path(delivery).parent

    def verify_binding(self) -> None:
        binding = read_object(
            Path(self.grant.common_git) / "artificer" / "installation.json"
        )
        if binding != {"root": str(self.root), "grant": self.grant.id}:
            raise ValueError(
                "Repository belongs to a different controlling installation"
            )
