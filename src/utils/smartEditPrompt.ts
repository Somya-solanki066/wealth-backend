export const DEFAULT_SMART_EDIT_PROMPT = `Analyze the provided text and evaluate it strictly against these 8 editing checks:
1. Grammar
2. Passive Voice
3. Filler Words
4. Stronger Verbs
5. Repetition
6. Pacing & Flow
7. Dialogue Quality (if applicable)
8. Plagiarism Check (flag potential unoriginal phrasing based on your knowledge)

Format the response as a JSON object with the following exact structure:
{
  "overallScore": <number between 0-100>,
  "checks": [
    {
      "name": "Grammar",
      "original": "<original text snippet>",
      "suggested": "<suggested rewrite>",
      "feedback": "<brief explanation>"
    },
    ... (include all 8 checks)
  ]
}
Ensure the output is ONLY valid JSON.
`;
