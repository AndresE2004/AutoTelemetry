from __future__ import annotations

import numpy as np
import pytest
from sklearn.ensemble import IsolationForest

from ml.isolation_detector import MODEL_VERSION, _anomaly_score_from_decision, _severity_from_score


def test_severity_buckets() -> None:
    assert _severity_from_score(-0.5) == "critical"
    assert _severity_from_score(-0.3) == "high"
    assert _severity_from_score(-0.15) == "medium"
    assert _severity_from_score(0.0) == "low"


def test_anomaly_score_range() -> None:
    s = _anomaly_score_from_decision(-0.8)
    assert 0.01 <= s <= 1.0


def test_iforest_detects_obvious_outliers() -> None:
    rng = np.random.default_rng(7)
    X = rng.normal(size=(300, 5), scale=(3.0, 5.0, 0.5, 200.0, 1.2))
    X[-5:] += np.array([25.0, 40.0, -3.0, 4000.0, 6.0])
    clf = IsolationForest(contamination=0.05, random_state=0).fit(X)
    pred = clf.predict(X)
    assert (pred[-5:] == -1).any()


def test_model_version_constant() -> None:
    assert MODEL_VERSION.startswith("iforest")
