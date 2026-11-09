# System Architecture

Browser frontend
      |
      v
Python API
      |
      v
SPHEREx archive retrieval
      |
      v
Scientific processing module
      |
      v
Processed chronological image frames
      |
      v
Browser visualisation

## Responsibilities

Aayush:
- API
- Archive queries
- Data retrieval
- Caching
- Deployment

Futa:
- FITS inspection
- Scientific processing
- Image alignment
- Difference imaging

Jonty:
- .NET frontend
- Three.js visualisation
- User interaction
- Demo and presentation
