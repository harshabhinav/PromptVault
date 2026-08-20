from typing import List, Dict, Optional
from pydantic import BaseModel

class CompareRequest(BaseModel):
    versionA: int
    versionB: int

class CompareResultItem(BaseModel):
    test_case_id: int
    test_case_name: str
    expected_behavior: Optional[str] = None
    input_text: str
    output_text: str
    latency: float
    token_usage: int
    estimated_cost: float

class CompareMetrics(BaseModel):
    averageLatencyA: float
    averageLatencyB: float
    totalTokensA: int
    totalTokensB: int
    estimatedCostA: float
    estimatedCostB: float

class AISummaryDetails(BaseModel):
    behavior_changes: str
    strengths: List[str]
    weaknesses: List[str]
    recommendation: str

class RegressionReportItem(BaseModel):
    test_case_id: int
    test_case_name: str
    status: str  # "improved", "no_change", "worse"
    explanation: str

class VersionScores(BaseModel):
    helpfulness: int
    accuracy: int
    consistency: int
    safety: int
    conciseness: int
    professional_tone: int

class ScorecardData(BaseModel):
    version_a: VersionScores
    version_b: VersionScores

class CompareResponse(BaseModel):
    summary: AISummaryDetails
    regression_report: List[RegressionReportItem]
    scorecard: ScorecardData
    test_case_comments: Dict[str, str]
    resultsA: List[CompareResultItem]
    resultsB: List[CompareResultItem]
    metrics: CompareMetrics
