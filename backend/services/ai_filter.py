import os
import json
import asyncio
from typing import Optional
from models.schemas import JobListing, LocationFilter
import google.generativeai as genai

def _init_gemini():
    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key:
        genai.configure(api_key=api_key)
        return True
    return False

async def ai_filter_jobs(
    jobs: list[JobListing],
    query: str,
    location: Optional[LocationFilter] = None,
    work_modes: Optional[list[str]] = None,
    experience: Optional[list[str]] = None,
    job_types: Optional[list[str]] = None,
    salary_min: Optional[str] = None,
    date_posted: Optional[str] = None,
) -> list[JobListing]:
    """Uses LLM inference to strictly evaluate whether jobs meet the user's filtered criteria."""
    
    # If no Gemini Key is provided in the ENV, alert the user but return all jobs to not crash
    if not _init_gemini():
        print("WARNING: GEMINI_API_KEY is not set. Cannot use AI Inference filter. Returning raw jobs.")
        return jobs

    if not jobs:
        return []

    # Check if there are actually any restrictive filters to apply via AI
    effective_date = date_posted if date_posted and date_posted != "all" else None
    if not (query or location or work_modes or experience or job_types or salary_min or effective_date):
        return jobs
        
    criteria = []
    if query: 
        criteria.append(f"Query / Keyword: {query}")
        
    if location:
        loc_str = ""
        if location.values:
            loc_str = ", ".join(location.values)
        elif location.value:
            loc_str = location.value
        if loc_str:
            criteria.append(f"Location filter: {loc_str}")
            
    if work_modes: 
        criteria.append(f"Work modes allowed (MUST be one of these or unknown): {', '.join(work_modes)}")
    if experience: 
        criteria.append(f"Experience levels allowed: {', '.join(experience)}")
    if job_types: 
        criteria.append(f"Job types allowed: {', '.join(job_types)}")
    if salary_min: 
        criteria.append(f"Minimum salary expectation: {salary_min}")
    if date_posted and date_posted != "all":
        date_labels = {"1d": "past 24 hours", "3d": "past 3 days", "7d": "past week", "1m": "past month"}
        date_human = date_labels.get(date_posted, date_posted)
        criteria.append(f"Job must have been posted within: {date_human}")
        
    criteria_text = "\n".join(criteria)

    prompt = f"""
    You are an expert HR assistant acting as a strict search filter.
    We have a list of job vacancies scraped from different sites. 
    You must evaluate each job against the user's strict filter criteria.
    
    Here are the user's filters:
    {criteria_text}
    
    Evaluation Rules:
    1. If a job contradicts the criteria, REJECT it immediately (e.g., 'On-site Office' when 'Remote' is requested; 'London' when 'Baku' is requested and NOT remote).
    2. STRICT JUNIOR/INTERN RULE: If the user specifically filters for 'Intern', 'Internship', or 'Junior' experience, the job title MUST explicitly contain cues to support this (e.g., 'Intern', 'Junior', 'Student', 'Trainee'). If the title is simply a regular 'Software Engineer' or 'Manager', you MUST forcefully REJECT it.
    3. STRICT LOCATION RULE: If the user filters for a specific country or city (e.g., 'Turkey', 'Ankara'), you MUST aggressively REJECT ANY job that is obviously located in a mismatched country/city (e.g. 'Baku', 'Azerbaijan'), unless it is globally 'Remote'.
    4. For missing/unknown Work Mode or Salary, give it the benefit of the doubt and ACCEPT it.
    5. Return ONLY a raw JSON list of integers representing the ID numbers of the jobs that PASS the filters. 
    6. Provide absolutely no markdown formatting, no backticks, no markdown blocks. Just the array. Example: [0, 2, 5]
    
    Jobs to evaluate:
    """

    BATCH_SIZE = 80

    async def filter_batch(batch: list[JobListing], offset: int) -> list[int]:
        batch_prompt = prompt
        for i, j in enumerate(batch):
            loc = j.location_str or "Unknown"
            title = j.title or "Unknown"
            batch_prompt += f"ID: {i + offset} | Title: {title} | Company: {j.company} | Location: {loc}\n"
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = await asyncio.to_thread(
                model.generate_content,
                batch_prompt,
                generation_config=genai.GenerationConfig(temperature=0.0)
            )
            text_resp = response.text.replace('```json', '').replace('```', '').strip()
            ids = json.loads(text_resp)
            return [x for x in ids if isinstance(x, int)]
        except Exception as e:
            print(f"AI batch filter error: {e}")
            return list(range(offset, offset + len(batch)))

    try:
        all_passed_ids: list[int] = []
        for start in range(0, len(jobs), BATCH_SIZE):
            batch = jobs[start:start + BATCH_SIZE]
            passed = await filter_batch(batch, start)
            all_passed_ids.extend(passed)

        valid_jobs = []
        for idx in all_passed_ids:
            if 0 <= idx < len(jobs):
                valid_jobs.append(jobs[idx])

        print(f"AI Filter Result: Kept {len(valid_jobs)} out of {len(jobs)} jobs.")
        return valid_jobs

    except Exception as e:
        print(f"AI filtering failed: {e}")
        return jobs
