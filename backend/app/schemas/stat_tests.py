from pydantic import BaseModel


class TTestResult(BaseModel):
    metric: str
    metric_label: str
    group1_mean: float
    group2_mean: float
    t_statistic: float
    p_value: float
    significant: bool
    group1_n: int
    group2_n: int


class ChiSquareResult(BaseModel):
    chi2_statistic: float
    p_value: float
    degrees_of_freedom: int
    significant: bool
    contingency_table: list[list[int]]


class CorrelationResult(BaseModel):
    variable: str
    variable_label: str
    method: str
    correlation: float
    p_value: float
    significant: bool
