# Video analysis notes

## Preserve evidence before summarising

A single prose description is useful in the interface, but it is a lossy compression of the source video. The app should treat the video as the source of truth and ask the model for structured, timestamped visual observations first.

The patient-facing summary can then be generated from those observations.

## Proposed first-pass response

```json
{
  "overall_activity": "Preparing and eating an evening meal",
  "events": [
    {
      "time_range": "00:00-00:08",
      "observed_activity": "Person places a ready meal on a table",
      "visible_objects": ["meal tray", "table", "cutlery"],
      "confidence": "high"
    },
    {
      "time_range": "00:09-00:20",
      "observed_activity": "Person eats while seated",
      "visible_objects": ["meal tray", "drink"],
      "confidence": "high"
    }
  ],
  "uncertainties": [
    "The food contents and portion size cannot be determined reliably."
  ]
}
```

## Prompting principles

- Inspect the full video and return timestamped visual observations.
- Describe only visible activity, objects, and context; ignore speech/audio.
- Separate observations from inferences.
- State uncertainty plainly.
- Do not infer diagnoses, emotions, calories, exercise intensity, or other sensitive attributes.

For the hackathon POC, make this one multimodal analysis call and render both the timeline and a short friendly summary from its structured response.
