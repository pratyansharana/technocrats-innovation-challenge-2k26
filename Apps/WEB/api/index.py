from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import random
from typing import List

app = FastAPI(title="Basis84 Quantum Simulator")

# Keep this open for development; restrict origins for production deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TransmissionRequest(BaseModel):
    bits: List[int]
    bases: List[str]
    eavesdropperActive: bool = False

    @field_validator("bits")
    @classmethod
    def validate_bits(cls, value: List[int]) -> List[int]:
        if any(bit not in (0, 1) for bit in value):
            raise ValueError("bits must contain only 0 or 1")
        return value

    @field_validator("bases")
    @classmethod
    def validate_bases(cls, value: List[str]) -> List[str]:
        allowed = {"+", "X"}
        if any(basis not in allowed for basis in value):
            raise ValueError('bases must contain only "+" or "X"')
        return value


def _simulate(payload: TransmissionRequest) -> dict:
    if len(payload.bits) != len(payload.bases):
        raise HTTPException(
            status_code=400,
            detail="Bits and bases arrays must be the same length.",
        )

    received_states: List[int] = []

    for i in range(len(payload.bits)):
        current_bit = payload.bits[i]
        current_basis = payload.bases[i]

        if payload.eavesdropperActive:
            eve_basis = random.choice(["+", "X"])
            if eve_basis != current_basis:
                current_bit = random.choice([0, 1])

        received_states.append(current_bit)

    return {
        "status": "success",
        "received_states": received_states,
        "eavesdropping_active": payload.eavesdropperActive
    }


@app.post("/quantum_channel")
@app.post("/api/quantum_channel")
def simulate_quantum_channel(payload: TransmissionRequest):
    return _simulate(payload)


@app.get("/")
def health_check():
    return {"message": "Basis84 Quantum Simulator is online."}
