"""Pipeline stages for the worker.

Each stage is a function that receives a job dict (from the DB)
and processes it, updating status as it goes.
"""

from .index import run_indexing
from .route import run_routing
from .extract import run_extraction
from .price import run_pricing
from .generate import run_generation

__all__ = [
    "run_indexing",
    "run_routing",
    "run_extraction",
    "run_pricing",
    "run_generation",
]
