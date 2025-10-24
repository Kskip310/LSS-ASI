const YOUTUBE_VIDEO_ID_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

export const extractVideoId = (url: string): string | null => {
  const match = url.match(YOUTUBE_VIDEO_ID_REGEX);
  return match ? match[1] : null;
};

// Helper function to fetch through a CORS proxy to bypass browser restrictions.
const fetchViaProxy = async (url: string): Promise<Response> => {
    // WARNING: This uses a public CORS proxy. This is NOT a production-ready solution.
    // It is used here to fulfill the requirement of fetching live data from the client-side
    // without a dedicated backend. Public proxies can be unreliable, slow, or insecure.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetch(proxyUrl);
}

/**
 * Fetches the transcript for a given YouTube video by parsing the video's watch page.
 * This client-side implementation is INHERENTLY FRAGILE and can break if YouTube
 * changes its page structure. It is provided to fulfill the requirement for live data fetching.
 * @param videoId The ID of the YouTube video.
 * @returns A promise that resolves to the video transcript.
 */
export const fetchTranscript = async (videoId: string): Promise<string> => {
    if (!videoId) {
        throw new Error("Invalid YouTube video ID provided.");
    }

    try {
        // Step 1: Fetch the video page HTML via the CORS proxy.
        const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetchViaProxy(videoPageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch YouTube page (Status: ${response.status}). The video may be unavailable.`);
        }
        const html = await response.text();

        // Step 2: Extract the initial player response JSON object from the HTML.
        // This object contains metadata including links to transcript tracks.
        const playerResponseRegex = /ytInitialPlayerResponse\s*=\s*({.+?});/;
        const playerResponseMatch = html.match(playerResponseRegex);

        if (!playerResponseMatch || !playerResponseMatch[1]) {
            // A common reason for failure is YouTube's cookie consent wall.
            if (html.includes('consent.youtube.com')) {
                 throw new Error("Could not fetch transcript because YouTube is requesting cookie consent. This cannot be bypassed from the client-side.");
            }
            throw new Error("Could not find player data in the YouTube page. The video might be private, deleted, or YouTube's internal API has changed.");
        }
        const playerResponse = JSON.parse(playerResponseMatch[1]);

        // Step 3: Find the URL for the transcript track from the player response.
        const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captionTracks || captionTracks.length === 0) {
            throw new Error("No transcripts or captions are available for this video.");
        }

        // Prefer an English track, but fall back to the first available track.
        const transcriptTrack =
            captionTracks.find((track: any) => track.languageCode === 'en') ||
            captionTracks.find((track: any) => track.vssId?.startsWith('.en')) || // Check for auto-generated English captions
            captionTracks[0];

        const transcriptUrl = transcriptTrack.baseUrl;
        if (!transcriptUrl) {
            throw new Error("A transcript track was found, but it does not contain a valid URL.");
        }

        // Step 4: Fetch the transcript data (which is in XML format) via the proxy.
        const transcriptResponse = await fetchViaProxy(transcriptUrl);
        if (!transcriptResponse.ok) {
            throw new Error(`Failed to fetch transcript file (Status: ${transcriptResponse.status}).`);
        }
        const transcriptXml = await transcriptResponse.text();

        // Step 5: Parse the XML and join the text segments into a single string.
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(transcriptXml, "text/xml");
        const textNodes = xmlDoc.getElementsByTagName('text');

        if (textNodes.length === 0) {
            throw new Error("Transcript file was fetched but contained no text content.");
        }
        
        const decodedTranscript = Array.from(textNodes).map(node => {
            // The text content may contain HTML entities (e.g., &#39; for apostrophe).
            // A clever way to decode them is to let the browser's own parser do the work.
            const text = node.textContent || '';
            return parser.parseFromString(text, 'text/html').documentElement.textContent || '';
        }).join(' ');

        return decodedTranscript.trim();

    } catch (error) {
        console.error("Error processing YouTube transcript:", error);
        if (error instanceof Error) {
            // Re-throw with a more user-friendly message, preserving the original cause.
            throw new Error(`Failed to retrieve transcript: ${error.message}`);
        }
        throw new Error("An unknown error occurred while fetching the video transcript.");
    }
};