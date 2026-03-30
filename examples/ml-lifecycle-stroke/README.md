# Toy Project: ML Stroke Prediction

This example demonstrates the full Machine Learning Lifecycle using the "Isaac" protocol. You will predict the probability of a patient having a stroke based on clinical features.

## 1. Installation & Scaffolding

Navigate to a fresh directory and run:

```bash
# Scaffold the project with uv and W&B tracking
npx ma-agents init ml stroke-predict wandb
```

This creates the standard directory structure, initializes `uv`, and deploys the `.clinerules` and `CLAUDE.md` tailored for ML.

## 2. Getting the Data

We will use the **Stroke Prediction Dataset** from Kaggle.

1.  Download the dataset from: [Kaggle - Stroke Prediction Dataset](https://www.kaggle.com/datasets/fedesoriano/stroke-prediction-dataset)
2.  Place the `healthcare-dataset-stroke-data.csv` file into `data/raw/stroke.csv`.

## 3. The Isaac Protocol (Step-by-Step)

Invoke your AI agent (Claude, Cline, Gemini, etc.) and follow these stages:

### Stage 1 — /ml-ideation (Research Framing)
Provide the agent with the high-level goal: 
*"I want to predict the probability of stroke based on clinical features. High recall is critical as missing a stroke risk is more costly than a false alarm."*

**Outcome**: Isaac will generate `_bmad-output/planning-artifacts/research-thesis.md` and `ml-prd.md`.

### Stage 2 — /ml-eda (Data understanding)
Ask Isaac to analyze the raw data.
*"Run EDA on data/raw/stroke.csv. Focus on class imbalance and the correlation between age/hypertension and the target."*

**Outcome**: Isaac will run `eda_analyzer.py` and output an `eda-report.md`. You will discover that only ~5% of patients had a stroke, requiring class weighting.

### Stage 3 — /ml-architecture (Tech Stack)
*"Design the model architecture for this tabular data. I want to use XGBoost."*

**Outcome**: Isaac will define the stack in `ml-architecture.md` and update `pyproject.toml` with `xgboost`.

### Stage 4.5 — /ml-techspec (The Contract)
*"Lock the experiment parameters. I want at least 0.85 Recall."*

**Outcome**: Isaac creates a **TechSpec Contract**. Remember: once this is locked, you shouldn't modify it during training!

### Stage 6 — /ml-experiment (Execution)
*"Execute the training. Log the runs to W&B."*

**Outcome**: Isaac will write the training code (using the `assets/` templates) and run it. Metrics will appear in your W&B dashboard.

---

## Example Initial Prompt
Copy and paste the contents of `project-init-prompt.txt` to start your session.
