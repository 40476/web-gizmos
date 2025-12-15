let dataset = [];
let glossMap = {}; // gloss → array of mp4 URLs
let glosses = [];

// Load WLASL dataset JSON
fetch("WLASL_v0.3.json")
  .then(res => res.json())
  .then(data => {
    dataset = data;
    buildGlossMap(data);
    glosses = data.map(e => e.gloss.toLowerCase());
  });

// Build gloss → all mp4 URLs map
function buildGlossMap(data) {
  data.forEach(entry => {
    const urls = entry.instances
      .map(inst => inst.url)
      .filter(url => url.endsWith(".mp4"));
    if (urls.length > 0) {
      glossMap[entry.gloss.toLowerCase()] = urls;
    }
  });
}

// Words to ignore
const ignoreWords = ["the", "a", "an", "to", "and"];

function glossText(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => !ignoreWords.includes(word))
    .map(word => ({
      gloss: word,
      urls: glossMap[word] || []
    }))
    .filter(entry => entry.urls.length > 0);
}

function fetchSequence() {
  const text = document.getElementById("userText").value;
  const entries = glossText(text);
  playSequence(entries);
}

function playSequence(entries) {
  const video = document.getElementById("aslVideo");
  let index = 0;

  // Prefetch all videos
  entries.forEach(entry => {
    entry.urls.forEach(url => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      document.head.appendChild(link);
    });
  });

  function tryPlay(entry, urlIndex = 0) {
    if (urlIndex < entry.urls.length) {
      video.src = entry.urls[urlIndex];
      video.play().catch(() => {
        // If playback fails, try next URL
        tryPlay(entry, urlIndex + 1);
      });
    }
  }

  function playNext() {
    if (index < entries.length) {
      tryPlay(entries[index]);
      index++;
    }
  }

  video.onended = playNext;
  playNext();
}

// --- Custom Autocomplete ---
const input = document.getElementById("userText");
const suggestionsBox = document.getElementById("suggestions");

input.addEventListener("input", () => {
  const words = input.value.toLowerCase().split(/\s+/);
  const lastWord = words[words.length - 1];
  
  if (!lastWord) {
    suggestionsBox.innerHTML = "";
    return;
  }

  const matches = glosses.filter(g => g.startsWith(lastWord)).slice(0, 6);

  suggestionsBox.innerHTML = "";
  matches.forEach(match => {
    const div = document.createElement("div");
    div.textContent = match;
    div.className = "suggestion";
    div.onclick = () => {
      words[words.length - 1] = match;
      input.value = words.join(" ");
      suggestionsBox.innerHTML = "";
    };
    suggestionsBox.appendChild(div);
  });
});
