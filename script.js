async function fetchMarkdown(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return await response.text();
  } catch (error) {
    console.error("Error fetching markdown:", error);
    return "";
  }
}

function parseMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    console.error('Invalid markdown input:', markdown);
    return { frontMatter: {}, content: '' };
  }

  const normalizedMarkdown = markdown.replace(/\r\n/g, '\n');
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = normalizedMarkdown.match(frontMatterRegex);

  if (!match) {
    console.error('No frontmatter found in markdown');
    return { frontMatter: {}, content: normalizedMarkdown };
  }

  const frontMatter = {};
  const frontMatterStr = match[1];

  frontMatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      frontMatter[key.trim()] = value;
    }
  });

  return {
    frontMatter,
    content: match[2]
  };
}

function markdownToHtml(markdown) {
  return markdown
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="post-image">')
    .replace(/^(.+)$/gm, function (match) {
      if (!/^<[^>]+>/.test(match)) {
        return '<p>' + match + '</p>';
      }
      return match;
    });
}

async function loadPost(postFile) {
  try {
    const markdown = await fetchMarkdown(`/posts/${postFile}`);
    const { frontMatter, content } = parseMarkdown(markdown);

    const existingPosts = document.querySelectorAll('.post-full');
    existingPosts.forEach(post => post.remove());

    const postsContainer = document.querySelector('.posts-container');
    if (postsContainer) {
      postsContainer.style.display = 'none';
    }

    const postContainer = document.createElement('div');
    postContainer.className = 'post-full';
    postContainer.innerHTML = `
      <h1>${frontMatter.title}</h1>
      <div class="post-meta">
        <span>${new Date(frontMatter.date).toLocaleDateString()}</span>
        ${frontMatter.readTime ? `<span>${frontMatter.readTime} min read</span>` : ''}
      </div>
      <div class="tags">
        ${(frontMatter.tags || '').split(',').map(tag =>
      `<span class="tag">${tag.trim()}</span>`
    ).join('')}
      </div>
      <div class="post-content">
        ${markdownToHtml(content)}
      </div>
      <a href="#" class="back-to-posts">← Back to posts</a>
    `;

    document.getElementById('home').appendChild(postContainer);
    window.scrollTo(0, 0);

    postContainer.querySelector('.back-to-posts').addEventListener('click', (e) => {
      e.preventDefault();
      postContainer.remove();
      if (postsContainer) {
        postsContainer.style.display = 'block';
      } else {
        loadPosts();
      }
      window.scrollTo(0, 0);
    });
  } catch (error) {
    console.error('Error loading post:', error);
    showErrorMessage('Failed to load the post. Please try again later.');
  }
}

async function loadPosts() {
  try {
    const response = await fetch('/posts/index.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const postsContainer = document.createElement('div');
    postsContainer.className = 'posts-container';

    if (!data.posts || !Array.isArray(data.posts) || data.posts.length === 0) {
      const noPostsMessage = document.createElement('div');
      noPostsMessage.className = 'no-posts-message';
      noPostsMessage.innerHTML = `
        <h2>Oops! No Posts Yet 😲</h2>
        <p>Looks like our writer is on a coffee break ☕. Check back later!</p>
      `;
      postsContainer.appendChild(noPostsMessage);
    } else {
      for (const post of data.posts) {
        if (!post.file) {
          console.error('Post missing file property:', post);
          continue;
        }

        try {
          const markdown = await fetchMarkdown(`/posts/${post.file}`);
          const { frontMatter, content } = parseMarkdown(markdown);

          if (!frontMatter || !frontMatter.title) {
            console.error('Invalid frontmatter for post:', post.file);
            continue;
          }

          const postElement = document.createElement('article');
          postElement.className = 'post';
          postElement.innerHTML = `
            <h2>${frontMatter.title}</h2>
            <div class="post-meta">
              <span>${new Date(frontMatter.date || post.date).toLocaleDateString()}</span>
              ${frontMatter.readTime ? `<span>${frontMatter.readTime} min read</span>` : ''}
            </div>
            <div class="post-content">
              ${frontMatter.excerpt || ''}
            </div>
            <div class="tags">
              ${(frontMatter.tags || '').split(',').map(tag =>
            `<span class="tag">${tag.trim()}</span>`
          ).join('')}
            </div>
            <a href="#" class="read-more" data-post="${post.file}">Read more</a>
          `;

          postsContainer.appendChild(postElement);
        } catch (postError) {
          console.error(`Error processing post ${post.file}:`, postError);
        }
      }
    }

    const homeContainer = document.getElementById('home');
    homeContainer.innerHTML = '';
    homeContainer.appendChild(postsContainer);

    document.querySelectorAll('.read-more').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const postFile = e.target.dataset.post;
        await loadPost(postFile);
      });
    });
  } catch (error) {
    console.error('Error loading posts:', error);
    showErrorMessage('Failed to load blog posts. Please try again later.');
  }
}

function initTheme() {
  const body = document.body;
  const themeToggle = document.querySelector('.theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
  body.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const isDark = body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

function initNavigation() {
  document.getElementById('home').style.display = 'block';
  document.getElementById('about').style.display = 'none';

  document.querySelector('.nav-links').addEventListener('click', e => {
    if (e.target.tagName === 'A' && e.target.hasAttribute('href')) {
      e.preventDefault();
      const targetId = e.target.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        const existingPosts = document.querySelectorAll('.post-full');
        existingPosts.forEach(post => post.remove());

        document.querySelectorAll('main > div').forEach(div => div.style.display = 'none');
        targetElement.style.display = 'block';

        if (targetId === 'home') {
          const postsContainer = document.querySelector('.posts-container');
          if (postsContainer) {
            postsContainer.style.display = 'block';
          } else {
            loadPosts();
          }
        }
      }
    }
  });
}

function initSocialLinks() {
  document.querySelectorAll('.social-link').forEach(link => {
    const tooltipSpan = link.querySelector('.tooltip');

    link.addEventListener('mouseover', () => {
      requestAnimationFrame(() => tooltipSpan.classList.add('active'));
    });

    link.addEventListener('mouseout', () => {
      requestAnimationFrame(() => tooltipSpan.classList.remove('active'));
    });

    link.addEventListener('click', (event) => {
      if (link.dataset.clipboard) {
        event.preventDefault();
        navigator.clipboard.writeText(link.dataset.clipboard).then(() => {
          const feedback = document.querySelector('.copy-feedback');
          feedback.classList.add('active');
          setTimeout(() => feedback.classList.remove('active'), 2000);
        }).catch(err => console.error("Failed to copy!", err));
      }
    });
  });
}

function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: var(--accent-color);
    color: white;
    padding: 1rem;
    border-radius: 4px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => errorDiv.remove(), 300);
  }, 5000);
}

async function init() {
  initTheme();
  initNavigation();
  initSocialLinks();
  await loadPosts();
}

init().catch(console.error);