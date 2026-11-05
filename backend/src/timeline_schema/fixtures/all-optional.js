{
  "meta": {
    "title": "All Optional",
    "author": "Test",
    "schemaVersion": 1,
    "version": 1,
    "defaultChronology": "ussher",
    "yearRange": [-2091, -930]
  },
  "nodes": [
    {
      "id": "n-full",
      "kind": "person",
      "label": "Full Person",
      "subtype": "patriarch",
      "time": {
        "anchor": "18th year of Josiah",
        "statedLength": 40,
        "statedUnit": "years",
        "derived": { "start": -1010, "end": -970, "chronology": "thiele" },
        "confidence": "approximate",
        "alternatives": [
          { "year": -1011, "chronology": "early", "note": "1 yr off" },
          { "year": -1009, "chronology": "late", "note": "1 yr off" }
        ],
        "derivation": {
          "steps": ["Step one", "Step two", "Step three"],
          "sources": ["1 Kgs 1:1", "2 Sam 5:4"]
        }
      },
      "displayOrder": 1,
      "roles": ["king", "prophet"],
      "group": "israel",
      "tags": ["monarchy", "messianic"],
      "source": ["1 Sam 16", "2 Sam 5"],
      "confidence": "scriptural",
      "locked": true,
      "note": "A note with special chars: <script>alert('xss')</script> & \"quotes\"."
    },
    {
      "id": "n-place-full",
      "kind": "place",
      "label": "Full Place",
      "modernName": "Modern Name",
      "coords": [31.7683, 35.2137],
      "siteCandidates": ["Candidate A", "Candidate B", "Candidate C"],
      "image": "media/jerusalem.jpg",
      "source": ["Josh 15"],
      "confidence": "archaeological",
      "locked": false,
      "note": "Disputed location."
    },
    {
      "id": "n-book-full",
      "kind": "book",
      "label": "Full Book",
      "author": { "name": "Unknown", "disputed": true },
      "genre": "Historical",
      "eventsDescribed": "-930 to -586",
      "time": { "confidence": "inferred", "derived": { "start": -560, "chronology": "standard" } },
      "source": ["Internal evidence"],
      "confidence": "inferred",
      "tags": ["historical"],
      "note": "Authorship debated."
    },
    {
      "id": "n-covenant-full",
      "kind": "covenant",
      "label": "Full Covenant",
      "terms": { "promise": "P", "condition": "C", "sign": "S" },
      "status": "awaiting",
      "time": { "confidence": "undated" },
      "source": ["Gen 17"],
      "confidence": "scriptural",
      "tags": ["covenant"],
      "note": "Still active."
    },
    {
      "id": "n-political-full",
      "kind": "political",
      "label": "Full Political",
      "trajectory": "declining",
      "group": "world",
      "time": { "confidence": "exact", "derived": { "start": -626, "end": -539, "chronology": "standard" } },
      "source": ["Babylonian king list"],
      "confidence": "archaeological",
      "tags": ["world-history"],
      "note": "Neo-Babylonian Empire."
    }
  ],
  "edges": [
    {
      "id": "e-full",
      "from": "n-full",
      "to": "n-covenant-full",
      "kind": "covenants",
      "subtype": "mediation",
      "confidence": "speculative",
      "source": ["Inferred from context"],
      "note": "Debatable connection.",
      "claim": "The person mediates the covenant.",
      "color": "#f59e0b",
      "locked": true
    }
  ],
  "display": {
    "blackAndWhite": true,
    "tracks": [
      { "id": "t1", "label": "Track 1", "color": "#2563eb", "filter": "kind == 'person'" },
      { "id": "t2", "label": "Track 2", "color": "#059669", "filter": "group == 'world'" }
    ]
  }
}   
