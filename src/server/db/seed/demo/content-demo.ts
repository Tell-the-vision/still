import type { ContentPackage } from "../content";

// Demo exhibitions with original monochrome artwork, for showing STILL off.
// Not part of the default seed: import by hand with `npm run db:seed src/server/db/seed/demo`.
// It upgrades forms-of-stillness and quiet-rooms in place and adds tidal-archive and breath-of-ink.
// They start on 2026-01-01 so Home (newest start first) lists the Figma demo exhibitions before them.
const pkg: ContentPackage = {
  "institution": {
    "code": "STILL-MUSEUM",
    "name": "Still Museum"
  },
  "venues": [
    {
      "code": "seoul-hall",
      "name": "Seoul Hall",
      "city": "Seoul"
    },
    {
      "code": "busan-gallery",
      "name": "Busan Gallery",
      "city": "Busan"
    }
  ],
  "exhibitions": [
    {
      "code": "forms-of-stillness",
      "venueCode": "seoul-hall",
      "title": "Forms of Stillness",
      "description": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "text": "Forms of Stillness is a series of studio photographs of smooth stones, balanced, scattered and alone, set against plain grey walls. Each object is lit from a single soft source, so that every surface is reduced to a gradient and every shadow to a quiet edge. Nothing is staged to tell a story; the stones simply hold their places and let the light describe them."
          },
          {
            "type": "paragraph",
            "text": "The images were made over many sessions, with stones gathered from riverbeds and arranged until they seemed to rest on their own. What interests the artist is the moment just after an arrangement succeeds, when the weight settles and nothing more needs to be done. The exhibition invites you to stand in front of that settling, and to notice how much calm a simple form can hold."
          }
        ]
      },
      "guide": {
        "version": 1,
        "blocks": [
          {
            "type": "heading",
            "text": "I. Balance"
          },
          {
            "type": "paragraph",
            "text": "Begin with the tower. Four stones and a small sphere rise from a plain white pedestal, each lighter or darker than the one beneath it, as if the tones were passed upward like a held breath. The smallest piece sits at the top with almost no contact, yet it does not move. Look at the shadow under the largest stone: it is the only thing that tells you how heavy the whole structure truly is."
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001101"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001102"
          },
          {
            "type": "heading",
            "text": "II. Scatter"
          },
          {
            "type": "paragraph",
            "text": "Here the order is released. Five stones lie across an open grey floor, some round, some long, one dark and heavy, one small and pale. Their shadows all lean the same way, drawn out by one low light. Nothing connects them, and still they seem to belong together, like words in a sentence whose meaning is the space between them."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001012"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001103"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001104"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001105"
          },
          {
            "type": "heading",
            "text": "III. Solitude"
          },
          {
            "type": "paragraph",
            "text": "The last image holds one stone and almost nothing else. It sits on the edge of a block, lit from the side, while the background falls away into near darkness. A faint seam curves across its surface like a thought that was never finished. Stay with it for a moment: the stillness here is not empty, only unhurried, and it asks nothing from you."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001013"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001106"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001107"
          }
        ]
      },
      "startDate": "2026-01-01",
      "endDate": "2030-12-31",
      "state": "PUBLISHED",
      "ambienceEnabled": true,
      "playlist": {
        "provider": "SPOTIFY",
        "url": "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ",
        "title": "Forms of Stillness",
        "description": null
      },
      "sentences": [
        {
          "id": "00000000-0000-4000-8000-000000001101",
          "content": "Balance is not the absence of weight but the agreement between weights."
        },
        {
          "id": "00000000-0000-4000-8000-000000001102",
          "content": "The smallest stone rests lightly because everything beneath it has already agreed to stay."
        },
        {
          "id": "00000000-0000-4000-8000-000000001103",
          "content": "Between objects, distance is also a kind of form."
        },
        {
          "id": "00000000-0000-4000-8000-000000001104",
          "content": "A single light is enough to make a family out of strangers."
        },
        {
          "id": "00000000-0000-4000-8000-000000001105",
          "content": "Shadows lean in one direction, and so the eye learns where to rest."
        },
        {
          "id": "00000000-0000-4000-8000-000000001106",
          "content": "When the background goes dark, a small thing is allowed to be everything."
        },
        {
          "id": "00000000-0000-4000-8000-000000001107",
          "content": "A stone has no need to explain how long it has been waiting."
        }
      ],
      "images": [
        {
          "id": "00000000-0000-4000-a000-000000001011",
          "file": "src/server/db/seed/demo/images/forms-of-stillness/cover.webp",
          "altText": "Four smooth stones balanced in a tower, ending in a small pale sphere, on a white cube pedestal against a soft gray wall, with a dark shadow beneath the largest stone.",
          "width": 1200,
          "height": 1500
        },
        {
          "id": "00000000-0000-4000-a000-000000001012",
          "file": "src/server/db/seed/demo/images/forms-of-stillness/detail-1.webp",
          "altText": "Five smooth stones of different sizes and tones scattered across a gray floor, a large pale sphere at left and a long dark stone beside it, each casting a long soft shadow to the right.",
          "width": 1600,
          "height": 1067
        },
        {
          "id": "00000000-0000-4000-a000-000000001013",
          "file": "src/server/db/seed/demo/images/forms-of-stillness/detail-2.webp",
          "altText": "A single pale egg-shaped stone with a faint curved seam rests on the edge of a gray block, lit from the side against a nearly black background, its shadow pooling beneath it.",
          "width": 1200,
          "height": 1500
        }
      ],
      "cover": 0
    },
    {
      "code": "quiet-rooms",
      "venueCode": "busan-gallery",
      "title": "Quiet Rooms",
      "description": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "text": "Quiet Rooms gathers photographs of empty interiors made over one winter in a vacant house above the harbour. Nothing happens in them except light: a shaft from an unseen window settling on plaster, a doorway opening onto a brighter room, the frame of a window bent across a corner. There are no people and no furniture, only walls, floor and the slow arithmetic of the sun."
          },
          {
            "type": "paragraph",
            "text": "The photographer, who has asked to remain unnamed, returned to the same rooms at the same hours until the light became the subject. Seen together, the images ask for a slower kind of looking. A room you would walk through without noticing becomes, for a few minutes each afternoon, a place where something arrives and leaves. This exhibition is about that visit, and about learning to wait for it."
          }
        ]
      },
      "guide": {
        "version": 1,
        "blocks": [
          {
            "type": "heading",
            "text": "I. Arrival"
          },
          {
            "type": "paragraph",
            "text": "Begin with the wall. A window you cannot see has been translated into light: six panes and the cross of the frame, softened at the edges because the sun is not a point but a small disc of fire. Notice that the edges blur more the farther the light has travelled. Below, the polished floor holds a second, fainter copy, as if the room were remembering what it had just seen."
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001201"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001202"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001203"
          },
          {
            "type": "heading",
            "text": "II. Threshold"
          },
          {
            "type": "paragraph",
            "text": "Here the camera stays in the darker room. Through the doorway a second space glows, its floor striped by a window we will never reach. One beam has slipped through both openings and lies across the boards at our feet, a long pale blade. The doorway is the brightest thing in the picture, yet it shows almost nothing. It is a promise more than a view."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001022"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001204"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001205"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001206"
          },
          {
            "type": "heading",
            "text": "III. Fold"
          },
          {
            "type": "paragraph",
            "text": "In the last room the sun is low. The window's shadow has been pulled long across one wall and then, at the corner, folded onto the next, where it grows brighter because it meets the plaster more directly. The bars of the frame bend without breaking. Stay a while: in an hour the shape will slide off the wall entirely, and the corner will be only a corner again."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001023"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001207"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001208"
          }
        ]
      },
      "startDate": "2026-01-01",
      "endDate": "2030-12-31",
      "state": "PUBLISHED",
      "ambienceEnabled": true,
      "playlist": null,
      "sentences": [
        {
          "id": "00000000-0000-4000-8000-000000001201",
          "content": "A window is most visible in the room it is not in."
        },
        {
          "id": "00000000-0000-4000-8000-000000001202",
          "content": "Every patch of sunlight is a portrait of the window that let it in."
        },
        {
          "id": "00000000-0000-4000-8000-000000001203",
          "content": "Softness at the edge is simply distance, written in light."
        },
        {
          "id": "00000000-0000-4000-8000-000000001204",
          "content": "A doorway is a picture of somewhere you have not yet decided to go."
        },
        {
          "id": "00000000-0000-4000-8000-000000001205",
          "content": "We stand in the dim room so that the bright one can exist."
        },
        {
          "id": "00000000-0000-4000-8000-000000001206",
          "content": "Some light travels through two rooms just to lie down at your feet."
        },
        {
          "id": "00000000-0000-4000-8000-000000001207",
          "content": "A corner is where light learns it must change direction to continue."
        },
        {
          "id": "00000000-0000-4000-8000-000000001208",
          "content": "Nothing in this room moves, except the only thing that matters."
        }
      ],
      "images": [
        {
          "id": "00000000-0000-4000-a000-000000001021",
          "file": "src/server/db/seed/demo/images/quiet-rooms/cover.webp",
          "altText": "A shaft of afternoon sunlight casts a six-pane window shape, crossed by soft mullion shadows, onto a gray plaster wall and folds down onto a polished concrete floor that faintly reflects it.",
          "width": 1200,
          "height": 1500
        },
        {
          "id": "00000000-0000-4000-a000-000000001022",
          "file": "src/server/db/seed/demo/images/quiet-rooms/detail-1.webp",
          "altText": "A dim empty room with a dark plaster wall and wooden floorboards, where an open doorway reveals a bright sunlit room beyond and a single narrow beam of light stretches across the floor.",
          "width": 1600,
          "height": 1067
        },
        {
          "id": "00000000-0000-4000-a000-000000001023",
          "file": "src/server/db/seed/demo/images/quiet-rooms/detail-2.webp",
          "altText": "Low sunlight stretches the shadow of a window frame across a plaster wall and folds it at a vertical corner onto the adjoining wall, where the light is narrower and brighter.",
          "width": 1200,
          "height": 1500
        }
      ],
      "cover": 0
    },
    {
      "code": "tidal-archive",
      "venueCode": "busan-gallery",
      "title": "Tidal Archive",
      "description": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "text": "Tidal Archive gathers long-exposure seascapes made along the southern coast in fog and low winter light. Each shutter stayed open for minutes, long enough for waves to settle into a single tone and for the horizon to soften into mist. What remains is a sea with its motion removed: a lone rock, a line of old piles, the last reach of a wave on sand."
          },
          {
            "type": "paragraph",
            "text": "The prints are silver-gelatin, quiet and close in tone, and they ask to be looked at slowly. Here time is not frozen but gathered: a minute of tide folded into one surface. The exhibition treats the photograph as an archive of duration rather than of moments, a record of how long the sea took to become still."
          }
        ]
      },
      "guide": {
        "version": 1,
        "blocks": [
          {
            "type": "heading",
            "text": "I. Horizon"
          },
          {
            "type": "paragraph",
            "text": "Begin with the stack. It stands just off the horizon, darker than anything else in the room, while fog takes the line between sky and water almost entirely. During the exposure the swell rose and fell hundreds of times; the print keeps none of it. Only the rock held still long enough to be recorded, and its reflection lies beneath it like a slower shadow."
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001301"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001302"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001303"
          },
          {
            "type": "heading",
            "text": "II. Distance"
          },
          {
            "type": "paragraph",
            "text": "The remains of a pier walk out into the mist, one pile at a time. Each post is a little paler than the one before, until wood and fog share the same gray and the line simply ends. Nothing marks where the structure stops. The eye keeps following it anyway, counting what it can no longer see."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001032"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001304"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001305"
          },
          {
            "type": "heading",
            "text": "III. Edge"
          },
          {
            "type": "paragraph",
            "text": "At the shore the camera looks down. A wave arrives as milk, spreads thin, and leaves a fringe of foam that the exposure turns to lace. Nearer to you, the sand shines with what the water left, holding the sky for a moment before it drains away. Each faint line on the sand is an earlier reach, already being erased."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001033"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001306"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001307"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001308"
          }
        ]
      },
      "startDate": "2026-01-01",
      "endDate": "2030-12-31",
      "state": "PUBLISHED",
      "ambienceEnabled": true,
      "playlist": null,
      "sentences": [
        {
          "id": "00000000-0000-4000-8000-000000001301",
          "content": "A long exposure keeps only what refuses to move."
        },
        {
          "id": "00000000-0000-4000-8000-000000001302",
          "content": "Fog does not hide the horizon; it teaches the eye to wait."
        },
        {
          "id": "00000000-0000-4000-8000-000000001303",
          "content": "The sea forgets every wave, but the rock remembers the whole hour."
        },
        {
          "id": "00000000-0000-4000-8000-000000001304",
          "content": "What has been abandoned can still hold a straight line out to sea."
        },
        {
          "id": "00000000-0000-4000-8000-000000001305",
          "content": "In fog, distance is only a softer shade of gray."
        },
        {
          "id": "00000000-0000-4000-8000-000000001306",
          "content": "Every wave writes its last line on the sand, then takes the page back."
        },
        {
          "id": "00000000-0000-4000-8000-000000001307",
          "content": "The edge of the sea is never a line, only a moment."
        },
        {
          "id": "00000000-0000-4000-8000-000000001308",
          "content": "Stillness is not the absence of motion but its long sum."
        }
      ],
      "images": [
        {
          "id": "00000000-0000-4000-a000-000000001031",
          "file": "src/server/db/seed/demo/images/tidal-archive/cover.webp",
          "altText": "A dark, rounded sea stack stands in fog just off a soft horizon, its blurred reflection falling into smooth gray water.",
          "width": 1200,
          "height": 1500
        },
        {
          "id": "00000000-0000-4000-a000-000000001032",
          "file": "src/server/db/seed/demo/images/tidal-archive/detail-1.webp",
          "altText": "A single line of weathered wooden piles recedes from the left foreground across still, misty water until it dissolves into the horizon.",
          "width": 1600,
          "height": 1067
        },
        {
          "id": "00000000-0000-4000-a000-000000001033",
          "file": "src/server/db/seed/demo/images/tidal-archive/detail-2.webp",
          "altText": "Seen from just above the shore, a milky wave edge fringed with foam lace spreads over dark wet sand beneath a pale, misty sea.",
          "width": 1200,
          "height": 1500
        }
      ],
      "cover": 0
    },
    {
      "code": "breath-of-ink",
      "venueCode": "seoul-hall",
      "title": "Breath of Ink",
      "description": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "text": "Breath of Ink gathers works on hanji, the Korean mulberry paper that drinks ink the instant it is touched. A circle left open, a range of mountains built from layered washes, a single stroke whose edges bleed into the fibers: each piece was made in one pass, with no correction possible."
          },
          {
            "type": "paragraph",
            "text": "The exhibition asks you to read the marks as records of time. Where the brush was loaded, the ink pools black; where it ran dry, the paper shows through in streaks of white. Look closely and you can see how long a hand paused, and where it chose to stop. Nothing here could be undone; that is what makes it worth keeping."
          }
        ]
      },
      "guide": {
        "version": 1,
        "blocks": [
          {
            "type": "heading",
            "text": "I. One Breath"
          },
          {
            "type": "paragraph",
            "text": "The circle in the first room was made in a single exhalation. The brush enters heavy and wet at the lower left, travels clockwise, and lifts before it can close. Follow the stroke with your eyes: black gives way to gray streaks, then to scattered threads where the hairs ran dry. The gap at the end is not an accident. It is where the breath ran out."
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001401"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001402"
          },
          {
            "type": "heading",
            "text": "II. Distance"
          },
          {
            "type": "paragraph",
            "text": "Three washes, three distances. The farthest ridge was laid down while the paper was still damp, so its edge softens into the sky. The nearer ranges were painted on dry paper, and each carries a faint darker line where the water stopped and the ink settled. Nothing is outlined. Depth comes only from how much water was mixed into the same black."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001042"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001403"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001404"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001405"
          },
          {
            "type": "heading",
            "text": "III. Bleed"
          },
          {
            "type": "paragraph",
            "text": "Up close, a single stroke becomes its own terrain. Along the wet upper edge, ink has crept outward into the mulberry fibers, leaving a soft gray haze with fine hairs where single fibers drank more than their neighbors. Lower down, the brush splits into separate strands and skims only the high points of the sheet. Hanji keeps both moments, the soaking and the skimming, side by side."
          },
          {
            "type": "image",
            "imageId": "00000000-0000-4000-a000-000000001043"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001406"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001407"
          },
          {
            "type": "sentence",
            "sentenceId": "00000000-0000-4000-8000-000000001408"
          }
        ]
      },
      "startDate": "2026-01-01",
      "endDate": "2030-12-31",
      "state": "PUBLISHED",
      "ambienceEnabled": true,
      "playlist": null,
      "sentences": [
        {
          "id": "00000000-0000-4000-8000-000000001401",
          "content": "A circle left open is not unfinished; it is a breath still going."
        },
        {
          "id": "00000000-0000-4000-8000-000000001402",
          "content": "Where the ink runs out, the paper begins to speak."
        },
        {
          "id": "00000000-0000-4000-8000-000000001403",
          "content": "Every gray here is the same black, carried a different distance by water."
        },
        {
          "id": "00000000-0000-4000-8000-000000001404",
          "content": "Mist is only the paper, left alone."
        },
        {
          "id": "00000000-0000-4000-8000-000000001405",
          "content": "The farthest mountain is the one painted with the most water and the least certainty."
        },
        {
          "id": "00000000-0000-4000-8000-000000001406",
          "content": "Paper that drinks ink cannot be lied to."
        },
        {
          "id": "00000000-0000-4000-8000-000000001407",
          "content": "A mark on hanji spreads as far as the paper allows, and no further."
        },
        {
          "id": "00000000-0000-4000-8000-000000001408",
          "content": "Ink does not sit on hanji; it becomes part of the paper."
        }
      ],
      "images": [
        {
          "id": "00000000-0000-4000-a000-000000001041",
          "file": "src/server/db/seed/demo/images/breath-of-ink/cover.webp",
          "altText": "A single black brushstroke on pale mulberry paper forms an open circle, heavy and wet at the lower left and breaking into dry gray streaks before it can close.",
          "width": 1200,
          "height": 1500
        },
        {
          "id": "00000000-0000-4000-a000-000000001042",
          "file": "src/server/db/seed/demo/images/breath-of-ink/detail-1.webp",
          "altText": "Three ranges of mountains in layered gray ink washes recede into mist, the nearest dark at the lower left and the farthest a soft pale silhouette against empty paper.",
          "width": 1600,
          "height": 1067
        },
        {
          "id": "00000000-0000-4000-a000-000000001043",
          "file": "src/server/db/seed/demo/images/breath-of-ink/detail-2.webp",
          "altText": "Close view of a thick black stroke sweeping down across fibrous paper, with a soft gray bleed along its wet edge and the brush splitting into dry, broken strands at its tip.",
          "width": 1200,
          "height": 1500
        }
      ],
      "cover": 0
    }
  ]
};

export default pkg;
