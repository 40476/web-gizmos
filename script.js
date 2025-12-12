let dataset = [];
let glossMap = {}; // auto-built from WLASL JSON

// Load WLASL dataset JSON
fetch("WLASL_v0.3.json")
.then(res => res.json())
.then(data => {
  dataset = data;
  buildGlossMap(data);
  populateAutocomplete(data);
});

// Build gloss → mp4 URL map automatically
function buildGlossMap(data) {
  data.forEach(entry => {
    const mp4Instance = entry.instances.find(inst => inst.url.endsWith(".mp4"));
    if (mp4Instance) {
      glossMap[entry.gloss.toLowerCase()] = mp4Instance.url;
    }
  });
}

// Populate autocomplete with glosses
function populateAutocomplete(data) {
  const datalist = document.getElementById("glossList");
  data.forEach(entry => {
    const option = document.createElement("option");
    option.value = entry.gloss;
    datalist.appendChild(option);
  });
}

// Words to ignore (articles, filler)
const ignoreWords = ["the", "a", "an", "to", "and"];

// Rule-based glosser using WLASL dataset
function glossText(text) {
  return text
  .toLowerCase()
  .split(/\s+/)
  .filter(word => !ignoreWords.includes(word))
  .map(word => ({
    gloss: word,
    url: glossMap[word] || null
  }))
  .filter(entry => entry.url); // only keep words with clips
}

function fetchSequence() {
  const text = document.getElementById("userText").value;
  const entries = glossText(text);
  const clips = entries.map(e => e.url);
  playSequence(clips);
}

function playSequence(clips) {
  const video = document.getElementById("aslVideo");
  let index = 0;
  
  function playNext() {
    if (index < clips.length) {
      video.src = clips[index];
      video.play();
      index++;
    }
  }
  
  video.onended = playNext;
  playNext();
}
