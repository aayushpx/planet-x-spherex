# API Contract

Initial development contract. Subject to revision after inspecting real SPHEREx data.

## GET /api/targets/{target}

Resolve a target name and return its coordinates.

## GET /api/targets/{target}/frames

Return chronological image frames for a target.

Example response:

{
  "target": "Barnard's Star",
  "coordinates": {
    "ra": 269.452,
    "dec": 4.693
  },
  "frames": [
    {
      "id": "frame-001",
      "timestamp": "2026-01-01T00:00:00Z",
      "image_url": "/samples/frame_001.png"
    },
    {
      "id": "frame-002",
      "timestamp": "2026-07-01T00:00:00Z",
      "image_url": "/samples/frame_002.png"
    }
  ]
}

The timestamps and paths above are illustrative, not real observations.

## Integration

The API returns image URLs and metadata.
The frontend is responsible for displaying frames and playback.
The science module processes observations before they are returned by the API.
