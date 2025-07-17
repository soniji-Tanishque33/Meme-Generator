// script.js - Handles frontend logic for AI Meme Chef (modern UI + dark mode)

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('meme-form');
  const topicInput = document.getElementById('topic');
  const memeResult = document.getElementById('meme-result');
  const memeImage = document.getElementById('meme-image');
  const spinner = document.getElementById('spinner');
  const generateBtn = document.getElementById('generate-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const surpriseBtn = document.getElementById('surprise-btn');
  const darkToggle = document.getElementById('dark-toggle');
  const logoEmoji = document.querySelector('.logo-emoji');
  const memeImageCard = document.querySelector('.meme-image-card');

  // Fun random topics for 'Surprise Me'
  const funTopics = [
    "final exams", "coding at 3am", "Monday mornings", "group projects", "WiFi problems", "gym motivation", "procrastination", "coffee addiction", "debugging bugs", "unexpected bills", "Zoom calls", "cat videos", "AI taking over", "weekend plans", "adulting", "gym vs pizza", "sleep schedule", "crypto hype", "inbox zero", "vacation planning"
  ];

  let lastTopic = '';

  // Dark mode logic
  function setDarkMode(on) {
    document.body.classList.toggle('dark-mode', on);
    if (on) {
      darkToggle.textContent = '☀️';
    } else {
      darkToggle.textContent = '🌙';
    }
    localStorage.setItem('memechef-dark', on ? '1' : '0');
  }
  // On load, set dark mode from localStorage
  setDarkMode(localStorage.getItem('memechef-dark') === '1');
  darkToggle.addEventListener('click', function () {
    const isDark = document.body.classList.contains('dark-mode');
    setDarkMode(!isDark);
    // Emoji shake on toggle
    logoEmoji.classList.add('shake');
    setTimeout(() => logoEmoji.classList.remove('shake'), 600);
  });

  // Show spinner
  function showSpinner() {
    spinner.classList.remove('hidden');
    memeResult.classList.add('hidden');
    generateBtn.disabled = true;
  }

  // Hide spinner
  function hideSpinner() {
    spinner.classList.add('hidden');
    generateBtn.disabled = false;
  }

  // Show meme result and action buttons
  function showMeme() {
    memeResult.classList.remove('hidden');
    regenerateBtn.classList.remove('hidden');
    surpriseBtn.classList.remove('hidden');
    // Fade-in meme image
    memeImage.classList.remove('visible');
    setTimeout(() => {
      memeImage.classList.add('visible');
    }, 50);
    // Smooth scroll to meme
    memeResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Hide meme result and action buttons
  function hideMeme() {
    memeResult.classList.add('hidden');
    regenerateBtn.classList.add('hidden');
    surpriseBtn.classList.add('hidden');
  }

  // Generate meme from topic
  async function generateMeme(topic) {
    showSpinner();
    hideMeme();
    try {
      const response = await fetch('/api/meme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      if (!response.ok) {
        let errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error('Server returned invalid or empty JSON.');
      }
      if (!data || data.error) throw new Error(data?.error || 'Unknown error');
      memeImage.classList.remove('visible');
      memeImage.src = data.imageUrl;
      memeImage.alt = data.caption;
      lastTopic = data.topic;
      // Wait for image to load before fade-in
      memeImage.onload = () => showMeme();
    } catch (err) {
      memeImage.src = '';
      hideMeme();
      alert('Error: ' + err.message);
    } finally {
      hideSpinner();
    }
  }

  // Form submit handler
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const topic = topicInput.value.trim();
    if (!topic) return;
    generateMeme(topic);
  });

  // Regenerate meme with same topic
  regenerateBtn.addEventListener('click', function () {
    if (lastTopic) {
      generateMeme(lastTopic);
    }
  });

  // Surprise Me: pick a random topic and fill input
  surpriseBtn.addEventListener('click', function () {
    const randomTopic = funTopics[Math.floor(Math.random() * funTopics.length)];
    topicInput.value = randomTopic;
    generateMeme(randomTopic);
  });

  // Emoji shake animation on button hover
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', function () {
      const emoji = btn.querySelector('.emoji');
      if (emoji) emoji.classList.add('shake');
    });
    btn.addEventListener('mouseleave', function () {
      const emoji = btn.querySelector('.emoji');
      if (emoji) emoji.classList.remove('shake');
    });
  });

  // Meme image pop effect on hover/tap
  memeImage.addEventListener('mouseenter', function () {
    memeImageCard && memeImageCard.classList.add('pop');
  });
  memeImage.addEventListener('mouseleave', function () {
    memeImageCard && memeImageCard.classList.remove('pop');
  });
  memeImage.addEventListener('touchstart', function () {
    memeImageCard && memeImageCard.classList.add('pop');
  });
  memeImage.addEventListener('touchend', function () {
    memeImageCard && memeImageCard.classList.remove('pop');
  });
}); 