"""
Verification microservice — independently re-derives an LLM-generated
answer via SymPy before it is ever stored or served to a student.

This is the hallucination firewall from the architecture doc: the
generation worker treats a failed verification as "do not serve", full
stop, not as a soft warning.
"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal
import math
import sympy as sp

app = FastAPI(title="AI Tutor Verification Service")


class VerifyRequest(BaseModel):
    problem_type: Literal["kinematics", "newtons_second_law", "kinetic_energy"]
    inputs: dict[str, float]
    claimed_answer: float


class VerifyResponse(BaseModel):
    verified: bool
    computed_answer: float
    tolerance: float
    detail: str | None = None


TOLERANCE = 0.05


def solve_kinematics(inputs: dict) -> float:
    u, v, t = sp.Float(inputs["u"]), sp.Float(inputs["v"]), sp.Float(inputs["t"])
    a = sp.symbols("a")
    expr = sp.Eq(a, (v - u) / t)
    return float(sp.solve(expr, a)[0])


def solve_newtons_second_law(inputs: dict) -> float:
    m, a = sp.Float(inputs["m"]), sp.Float(inputs["a"])
    F = sp.symbols("F")
    expr = sp.Eq(F, m * a)
    return float(sp.solve(expr, F)[0])


def solve_kinetic_energy(inputs: dict) -> float:
    m, v = sp.Float(inputs["m"]), sp.Float(inputs["v"])
    KE = sp.symbols("KE")
    expr = sp.Eq(KE, sp.Rational(1, 2) * m * v**2)
    return float(sp.solve(expr, KE)[0])


SOLVERS = {
    "kinematics": solve_kinematics,
    "newtons_second_law": solve_newtons_second_law,
    "kinetic_energy": solve_kinetic_energy,
}


@app.post("/verify", response_model=VerifyResponse)
def verify(req: VerifyRequest) -> VerifyResponse:
    solver = SOLVERS[req.problem_type]
    if not math.isfinite(req.claimed_answer) or any(
        not isinstance(value, (int, float)) or not math.isfinite(value)
        for value in req.inputs.values()
    ):
        return VerifyResponse(verified=False, computed_answer=0.0, tolerance=TOLERANCE, detail="Inputs must be finite numbers")
    try:
        computed = solver(req.inputs)
    except Exception as e:  # noqa: BLE001 — surface any symbolic failure as "not verified"
        return VerifyResponse(verified=False, computed_answer=0.0, tolerance=TOLERANCE, detail=str(e))

    if not math.isfinite(computed):
        return VerifyResponse(verified=False, computed_answer=0.0, tolerance=TOLERANCE, detail="Computed answer is not finite")

    verified = abs(computed - req.claimed_answer) <= TOLERANCE
    return VerifyResponse(verified=verified, computed_answer=computed, tolerance=TOLERANCE)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
