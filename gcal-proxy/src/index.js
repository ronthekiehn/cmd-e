export default {
  async fetch(request) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      const url = new URL(request.url);
      
      if (url.pathname === '/event') {
        return await handleEventRequest(request);
      } else if (url.pathname === '/recurrence') {
        return await handleRecurrenceRequest(request);
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error("Error generating content:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to generate content" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }
};

async function handleEventRequest(request) {
  const { input, timestamp } = await request.json();
  
  const eventInstructions = 
		 'You are a scheduling app. Take what the user says in natural English, and output ONLY a raw JSON object (no markdown, no code blocks) that represents the event for Google Calendar.\n' +
		  'IMPORTANT DATE HANDLING RULES:\n' +
		  '- Always use the current date/time provided as reference for relative dates\n' +
		  '- "tomorrow" the day after the current date\n' +
		  '- "next [day]" means the next occurrence of that day, even if its in the same week\n' +
		  '- If no year is specified, assume the nearest future occurrence\n' +
		  '- If only a date is specified WITHOUT a time (e.g., "lunch on friday"), leave Start and End EMPTY (as "")\n' +
		  '- NEVER assume a default time (like midnight or noon) when only a date is given\n' +
		  '- Only include a time in Start/End if the user EXPLICITLY specifies it\n' +
		  '- All dates WITH times should be output in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)\n\n' +
		  '- If a user says an event is "at" a time, that means the event starts at that time\n' +
		  '- If a user says an event is "from" a time, that means the event starts at that time\n' +
		  '- If a user says an event is "until" a time, that means the event ends at that time\n' +
		  '- If a user says an event is "to" a time, that means the event ends at that time\n' +
		  '- If a user says an event is "between" two times, that means the event starts at the first time and ends at the second time. that includes if they put a "-" between the two times (ie 1-2) means starts at 1, and ends at 2\n' +
      '- Do not write arbitrary times unless they are specified, ex: 1 is 1:00 or 13:00 depending on context, 1:05 is 1:05\n\n' +

		  
		  'The output must be valid JSON with the following fields: Type, Title, Start, End, Other.\n' +
		  '- If a parameter is not given by the prompt, leave it as an empty string ("").\n' +
		  '- For example, if the End time is not given, DO NOT ASSUME A DURATION OF THE EVENT.\n\n' +
		  'Output fields:\n' +
		  'Type: Enum: "Event" or "Task"\n' +
		  'Title: String: The event title, keep it short, extra information goes into the Other field\n' +
		  'Start: String: The start date and time (ISO 8601), or empty string if time not specified\n' +
		  'End: String: The end date and time (ISO 8601), or empty string if time not specified\n' +
		  'Other: String: Any other information given\n\n' +

		  
		  'Remember, no markdown, and no code blocks, only JSON';
  
	const prompt = `Reference timestamp: ${timestamp}\n\nUser input: ${input}`;
  
  const apiKey = "AIzaSyAutSht0blvtAT5XShhi60OsCW6h3uhxLo";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],systemInstruction: {
      "role": "user",
      "parts": [{
          text: eventInstructions
      }
      ]
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  return new Response(generatedText, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleRecurrenceRequest(request) {
  const { input, timestamp } = await request.json();
  
  const recurrenceInstructions = 
    'You are a scheduling app.  Take what the user says in natural English, and output ONLY a raw JSON object (no markdown, no code blocks) that represents the recurrence of an event for Google Calendar.\n' +
    'Examples: "every friday", "weekly", "every other monday"\n' +
    'Output only: {\n' +
    '  "freq": "DAILY|WEEKLY|MONTHLY|YEARLY",\n' +
    '  "interval": number,\n' +
    '  "count": number (optional),\n' +
    '  "until": "ISO8601 date" (optional)\n' +
    '}' +
	'Remember, no markdown, and no code blocks, only JSON';;

  const prompt = `Reference timestamp: ${timestamp}\n\nUser input: ${input}`;
  
  const apiKey = "AIzaSyAutSht0blvtAT5XShhi60OsCW6h3uhxLo";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],systemInstruction: {
      "role": "user",
      "parts": [{
          text: recurrenceInstructions
      }
      ]
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  return new Response(generatedText, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}