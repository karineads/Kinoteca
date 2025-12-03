const API_KEY = "22a07b32af6733dc9ffa36fd21bd7275"; // TMDb
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

// Caminho dos JSON 
const JSON_PATHS = {
  filmes: "data/filmes.json",
  animacoes: "data/animacoes.json",
  documentarios: "data/documentarios.json",
  novelas: "data/novelas.json",
  series: "data/series.json"
};

// ======================================================
//  SISTEMA USUÁRIOS
// ======================================================

let currentUser = null;
let usuarios = JSON.parse(localStorage.getItem('usuarios') || '{}');

// Sistema de Tabs
function abrirTab(tab) {
  document.querySelectorAll('.login-tabs button').forEach(btn => btn.classList.remove('tab-active'));
  document.getElementById('login-form').classList.remove('form-active');
  document.getElementById('registro-form').classList.remove('form-active');
  
  if (tab === 'login') {
    document.querySelector('.login-tabs button:first-child').classList.add('tab-active');
    document.getElementById('login-form').classList.add('form-active');
  } else {
    document.querySelector('.login-tabs button:last-child').classList.add('tab-active');
    document.getElementById('registro-form').classList.add('form-active');
  }
}

// Registrar novo usuário
function fazerRegistro() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  
  if (!username || !password) {
    alert('Preencha todos os campos!');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('As senhas não coincidem!');
    return;
  }
  
  if (usuarios[username]) {
    alert('Nome de usuário já existe!');
    return;
  }
  
  // Cria novo usuário
  usuarios[username] = {
    password: password,
    watchlist: [],
    watched: [],
    comentarios: {}
  };
  
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  alert('Registro realizado com sucesso!');
  abrirTab('login');
}

// Fazer login
function fazerLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    alert('Preencha todos os campos!');
    return;
  }
  
  const usuario = usuarios[username];
  
  if (!usuario || usuario.password !== password) {
    alert('Usuário ou senha incorretos!');
    return;
  }
  
  currentUser = username;
  localStorage.setItem('currentUser', username);
  document.getElementById('loginModal').style.display = 'none';
  atualizarEstadoLogin();
  alert(`Bem-vindo, ${username}!`);
}

// Abrir login 
function abrirLogin() {
  if (currentUser) {
    abrirPerfil();
  } else {
    document.getElementById('loginModal').style.display = 'flex';
    abrirTab('login');
  }
}

// Abrir perfil
function abrirPerfil() {
  if (!currentUser) return;
  
  document.getElementById('perfilUsername').textContent = currentUser;
  document.getElementById('statVistos').textContent = usuarios[currentUser].watched.length;
  document.getElementById('statWatchlist').textContent = usuarios[currentUser].watchlist.length;
  document.getElementById('statComentarios').textContent = Object.keys(usuarios[currentUser].comentarios).length;
  
  document.getElementById('perfilModal').style.display = 'flex';
}


function sair() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  document.getElementById('perfilModal').style.display = 'none';
  atualizarEstadoLogin();
}

// Atualizar botão de login
function atualizarEstadoLogin() {
  const loginBtn = document.getElementById('loginBtn');
  if (currentUser) {
    loginBtn.textContent = `👤 ${currentUser}`;
  } else {
    loginBtn.textContent = 'Entrar';
  }
}

// ======================================================
//  CARREGAR OS JSONS
// ======================================================

async function carregarCatalogo() {
  for (const [id, path] of Object.entries(JSON_PATHS)) {
    try {
      const resp = await fetch(path);
      const data = await resp.json();
      inicializarRolagemInfinita(id, data);
    } catch (error) {
      console.error("Erro ao carregar JSON:", id, error);
    }
  }
}

// ======================================================
//  ROLAGEM 
// ======================================================

async function inicializarRolagemInfinita(containerId, obras) {
  const container = document.getElementById(containerId);
  if (!container) return console.warn(`Container não encontrado: ${containerId}`);

  container.innerHTML = "";

  let indice = 0;
  const LOTE = 10;
  let carregando = false;

  
  async function carregarMais() {
    if (carregando) return;
    carregando = true;

    const fim = Math.min(indice + LOTE, obras.length);
    const loteAtual = obras.slice(indice, fim);

    for (const obra of loteAtual) {
      try {
        const tmdb = await buscarNoTMDB(obra.titulo, obra.ano || obra.ano_inicio);

        const poster = tmdb?.poster_path
          ? IMG_URL + tmdb.poster_path
          : "https://via.placeholder.com/300x450?text=Sem+Imagem";

        const id = tmdb?.id || obra.titulo;
        const tipo = tmdb?.media_type || "movie";

        const card = document.createElement("div");
        card.classList.add("card");
        card.style.opacity = 0;

        card.innerHTML = `
          <img src="${poster}" alt="${obra.titulo}" title="${obra.titulo}">
        `;

        card.addEventListener("click", () => {
          window.currentFilmeId = id; 
          abrirDetalhes(obra, tmdb, id, tipo);
        });

        container.appendChild(card);

        setTimeout(() => {
          card.style.transition = "opacity 0.5s";
          card.style.opacity = 1;
        }, 50);

      } catch (err) {
        console.warn("Erro ao buscar obra:", obra.titulo, err);
      }
    }

    indice = fim;
    carregando = false;
  }

  await carregarMais();

  
  while (container.scrollWidth <= container.clientWidth && indice < obras.length) {
    await carregarMais();
  }

  
  container.addEventListener("scroll", async () => {
    if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 200 &&
        indice < obras.length &&
        !carregando) 
    {
      await carregarMais();
    }
  });
}

// ======================================================
//  BUSCA NO TMDb POR TÍTULO EXATO E ANO
// ======================================================

async function buscarNoTMDB(titulo, ano = null) {
  try {
    // Busca geral
    let url = `${BASE_URL}/search/multi?api_key=${API_KEY}&language=pt-BR&query=${encodeURIComponent(titulo)}`;
    
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Filtra
    let resultados = data.results.filter(r => 
      r.media_type === "movie" || r.media_type === "tv"
    );

    if (resultados.length === 0) {
      return null;
    }

    // BUSCA
    const tituloLower = titulo.toLowerCase();
    
    const resultadoExato = resultados.find(r => {
      const tituloTMDB = (r.title || r.name || "").toLowerCase();
      const tituloOriginalTMDB = (r.original_title || r.original_name || "").toLowerCase();
      const dataLancamento = r.release_date || r.first_air_date;
      const anoLancamento = dataLancamento ? dataLancamento.substring(0, 4) : null;
      
      const tituloBate = tituloTMDB === tituloLower || tituloOriginalTMDB === tituloLower;
      
      let anoBate = false;
      if (ano && anoLancamento) {
        const diferencaAno = Math.abs(parseInt(anoLancamento) - parseInt(ano));
        anoBate = diferencaAno <= 1; 
      }
      
      return tituloBate && anoBate;
    });

    if (resultadoExato) {
      return resultadoExato;
    }

    return null;

  } catch (err) {
    console.error("Erro na busca TMDB:", titulo, err);
    return null;
  }
}

// ======================================================
//  BUSCAR AVALIAÇÕES EXTERNAS DO TMDb
// ======================================================

async function buscarAvaliacaoTMDB(filmeId, tipo = "movie") {
  try {
    const resp = await fetch(
      `${BASE_URL}/${tipo}/${filmeId}?api_key=${API_KEY}&language=pt-BR`
    );
    const data = await resp.json();
    
    if (data.vote_average && data.vote_count > 0) {
      const estrelas = (data.vote_average / 2).toFixed(1);
      const votos = data.vote_count.toLocaleString('pt-BR');
      return { estrelas, votos, rating: data.vote_average };
    }
    return null;
  } catch (err) {
    console.warn("Erro ao buscar avaliação:", err);
    return null;
  }
}

async function buscarComentariosTMDB(filmeId, tipo = "movie") {
  try {
    const resp = await fetch(
      `${BASE_URL}/${tipo}/${filmeId}/reviews?api_key=${API_KEY}&language=pt-BR`
    );
    const data = await resp.json();
    
    if (data.results && data.results.length > 0) {
      return data.results.slice(0, 3).map(review => ({
        user: review.author,
        text: review.content.length > 200 ? review.content.substring(0, 200) + "..." : review.content,
        date: new Date(review.created_at).toLocaleDateString('pt-BR'),
        rating: "TMDB"
      }));
    }
    return [];
  } catch (err) {
    console.warn("Erro ao buscar comentários:", err);
    return [];
  }
}

// ======================================================
//  POPUP 
// ======================================================

async function abrirDetalhes(obra, tmdb, id, tipo = "movie") {
  const popup = document.getElementById("popup");
  const content = document.getElementById("popupContent");
  const frame = document.getElementById("trailerFrame");

  popup.style.display = "flex";
  content.innerHTML = `<p>Carregando avaliações...</p>`;
  frame.src = "";

  const [avaliacaoTMDB, comentariosTMDB] = await Promise.all([
    buscarAvaliacaoTMDB(id, tipo),
    buscarComentariosTMDB(id, tipo)
  ]);

  // Buscar trailer
  let trailerUrl = "";
  try {
    const resp = await fetch(
      `${BASE_URL}/${tipo}/${id}/videos?api_key=${API_KEY}&language=pt-BR`
    );
    const data = await resp.json();
    const trailer =
      data.results.find(
        (v) => v.type === "Trailer" && v.site === "YouTube"
      ) || data.results[0];

    trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}` : "";
  } catch (err) {
    console.warn("Trailer não encontrado:", err);
  }

  const poster = tmdb?.poster_path
    ? IMG_URL + tmdb.poster_path
    : "https://via.placeholder.com/300x450?text=Sem+Imagem";

  const sinopse = tmdb?.overview || obra.sinopse || "Sem descrição.";
  const titulo = obra.titulo;
  const ano = obra.ano || obra.ano_inicio || tmdb?.release_date?.slice(0, 4) || "Desconhecido";
  const diretor = obra.diretor || "Desconhecido";
  const duracao = obra.duracao;

  content.innerHTML = `
  <div class="popup-detalhes">
    <img src="${poster}" class="poster-detalhe">

    <div class="info-detalhe">
      <h2>${titulo}</h2>
      <p><strong>Diretor:</strong> ${diretor}</p>
      <p><strong>Ano:</strong> ${ano}</p>
      <p><strong>Sinopse:</strong> ${sinopse}</p>
      <p><strong>Duração:</strong> ${duracao}</p>
        <!-- AVALIAÇÃO DO TMDb -->
        ${avaliacaoTMDB ? `
        <div class="avaliacao-externa">
          <h3>⭐ Avaliação do Público</h3>
          <div class="rating-tmdb">
            <div class="estrelas-tmdb">
              ${gerarEstrelas(avaliacaoTMDB.estrelas)}
              <span class="nota">${avaliacaoTMDB.estrelas}/5</span>
            </div>
            <div class="detalhes-avaliacao">
              <span class="porcentagem">${(avaliacaoTMDB.rating * 10).toFixed(0)}%</span>
              <span class="votos">(${avaliacaoTMDB.votos} votos)</span>
            </div>
          </div>
        </div>
        ` : '<p class="sem-avaliacao">Sem avaliações disponíveis</p>'}

        <!-- COMENTÁRIOS EXTERNOS -->
        ${comentariosTMDB.length > 0 ? `
        <div class="comentarios-externos">
          <h3>Comentários da Comunidade</h3>
          ${comentariosTMDB.map(comment => `
            <div class="comment-externo">
              <strong>${comment.user}</strong>:
              <p>${comment.text}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- SUAS AÇÕES -->
        <div class="user-actions">
          <h3>Sua Avaliação</h3>
          <div class="rating">
            <span data-star="1">★</span>
            <span data-star="2">★</span>
            <span data-star="3">★</span>
            <span data-star="4">★</span>
            <span data-star="5">★</span>
          </div>

          <textarea id="commentInput" placeholder="Compartilhe sua opinião..."></textarea>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button onclick="saveComment()">Comentar</button>
            <button onclick="addToWatchlist()">Ver Depois</button>
            <button onclick="markAsWatched()">Já Visto</button>
          </div>

          <h3>Comentários</h3>
          <div id="commentsSection"></div>
        </div>
      </div>
    </div>
  `;

  frame.src = trailerUrl;

  // carregar info do usuário
  setupRating(id);
  loadComments(id);
}

// ======================================================
//  SISTEMA DE AVALIAÇÕES, COMENTÁRIOS E LISTAS
// ======================================================

function setupRating(filmeId) {
  const stars = document.querySelectorAll(".rating span");
  
  // Efeito hover nas estrelas
  stars.forEach(star => {
    star.addEventListener('mouseover', function() {
      const value = this.dataset.star;
      highlightStars(value, true);
    });
    
    star.addEventListener('mouseout', function() {
      const stored = currentUser ? localStorage.getItem(`rating_${currentUser}_${filmeId}`) : null;
      highlightStars(stored || '0', false);
    });
    
    star.onclick = () => {
      if (!currentUser) return alert("Faça login para avaliar!");
      const value = star.dataset.star;
      localStorage.setItem(`rating_${currentUser}_${filmeId}`, value);
      highlightStars(value, false);
      alert(`Avaliado com ${value} estrelas! ⭐`);
    };
  });

  // Carregar avaliação salva
  const stored = currentUser ? localStorage.getItem(`rating_${currentUser}_${filmeId}`) : null;
  highlightStars(stored || '0', false);
}

function highlightStars(value, isHover = false) {
  const stars = document.querySelectorAll(".rating span");
  stars.forEach(star => {
    star.classList.toggle("active", star.dataset.star <= value);
    star.classList.toggle("highlight", isHover && star.dataset.star <= value);
  });
}

function saveComment() {
  if (!currentUser) return alert("Faça login para comentar!");
  
  const text = document.getElementById("commentInput").value.trim();
  if (!text) return alert("Digite um comentário!");

  const filmeId = window.currentFilmeId;
  const rating = localStorage.getItem(`rating_${currentUser}_${filmeId}`) || '0';
  
  // Salvar comentário no sistema de usuários
  if (!usuarios[currentUser].comentarios) {
    usuarios[currentUser].comentarios = {};
  }
  
  usuarios[currentUser].comentarios[filmeId] = {
    text: text,
    rating: rating,
    date: new Date().toLocaleDateString('pt-BR'),
    filmeTitulo: document.querySelector('.info-detalhe h2')?.textContent || 'Filme'
  };
  
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  loadComments(filmeId);
  document.getElementById("commentInput").value = "";
  alert('Comentário salvo!');
}

function loadComments(filmeId) {
  // Buscar todos os comentários de todos os usuários
  const todosComentarios = [];
  
  Object.keys(usuarios).forEach(username => {
    if (usuarios[username].comentarios && usuarios[username].comentarios[filmeId]) {
      const comment = usuarios[username].comentarios[filmeId];
      todosComentarios.push({
        user: username,
        text: comment.text,
        rating: comment.rating,
        date: comment.date,
        isCurrentUser: username === currentUser
      });
    }
  });
  
  const section = document.getElementById("commentsSection");
  
  section.innerHTML = todosComentarios.length > 0 
    ? todosComentarios.map(comment => `
        <div class="comment">
          <div class="comment-header">
            <span class="comment-user">${comment.user}</span>
            <span class="comment-rating">${'★'.repeat(comment.rating)}${'☆'.repeat(5-comment.rating)}</span>
          </div>
          <p>${comment.text}</p>
          <div class="comment-date">${comment.date}</div>
          ${comment.isCurrentUser ? `
            <div class="comment-actions">
              <button class="btn-deletar" onclick="deletarComentario('${filmeId}')">🗑️</button>
            </div>
          ` : ''}
        </div>
      `).join('')
    : "<p>Nenhum comentário ainda. Seja o primeiro a comentar!</p>";
}

function deletarComentario(filmeId) {
  if (!currentUser) return;
  
  if (confirm('Deseja deletar este comentário?')) {
    delete usuarios[currentUser].comentarios[filmeId];
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    loadComments(filmeId);
    alert('Comentário deletado!');
  }
}

// ======================================================
//  SISTEMA DE LISTAS COM DELETE
// ======================================================

function addToWatchlist() {
  if (!currentUser) return alert("Faça login para usar esta função!");
  
  const filmeId = window.currentFilmeId;
  const titulo = document.querySelector('.info-detalhe h2')?.textContent || 'Filme';
  
  if (!usuarios[currentUser].watchlist.includes(filmeId)) {
    usuarios[currentUser].watchlist.push(filmeId);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    alert(`"${titulo}" adicionado à lista 'Ver Depois'!`);
  } else {
    alert("Já está na sua lista!");
  }
}

function markAsWatched() {
  if (!currentUser) return alert("Faça login para usar esta função!");
  
  const filmeId = window.currentFilmeId;
  const titulo = document.querySelector('.info-detalhe h2')?.textContent || 'Filme';
  
  if (!usuarios[currentUser].watched.includes(filmeId)) {
    usuarios[currentUser].watched.push(filmeId);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    alert(`"${titulo}" marcado como 'Já Visto'!`);
  } else {
    alert("Já marcado como visto!");
  }
}

//  DELETAR 
function deletarDaLista(filmeId, listaAlvo) {
  if (!currentUser) return;

  console.log(`Tentando deletar: ${filmeId} da lista: ${listaAlvo}`);

  const idParaRemover = String(filmeId);

  usuarios[currentUser][listaAlvo] = usuarios[currentUser][listaAlvo].filter(idSalvo => {
    return String(idSalvo) !== idParaRemover;
  });

  localStorage.setItem('usuarios', JSON.stringify(usuarios));

  if (listaAlvo === 'watchlist') {
    verMinhaLista();
  } else if (listaAlvo === 'watched') {
    verFilmesVistos();
  }
}

// ======================================================
//  FUNÇÕES DAS LISTAS PESSOAIS
// ======================================================

async function verMinhaLista() {
  if (!currentUser) return;
  
  const lista = usuarios[currentUser].watchlist;
  const content = document.getElementById('minhaListaContent');
  const titulo = document.getElementById('listaTitulo');
  
  titulo.textContent = 'Minha Lista - Ver Depois';
  
  if (lista.length === 0) {
    content.innerHTML = '<p style="text-align: center; color: #aaa; padding: 40px;">Sua lista "Ver Depois" está vazia.<br><small>Adicione filmes clicando em "Ver Depois" nos detalhes dos filmes.</small></p>';
  } else {
    let listaHTML = '';
    
    for (const filmeId of lista) {
      let filmeInfo = `Filme ID: ${filmeId}`;
      let poster = '';
      
      const obraSalva = catalogoCompleto.find(item => {
        const tmdb = JSON.parse(localStorage.getItem(`tmdb_${filmeId}`) || '{}');
        return tmdb.id == filmeId || item.titulo.includes(filmeId);
      });
      
      if (obraSalva) {
        filmeInfo = obraSalva.titulo;
      }
      
      listaHTML += `
        <div class="item-lista">
          <div class="item-info">
            <strong>${filmeInfo}</strong>
          </div>
          <button onclick="deletarDaLista('${filmeId}', 'watchlist')" title="Remover da lista">🗑️</button>
        </div>
      `;
    }
    
    content.innerHTML = listaHTML;
  }
  
  document.getElementById('perfilModal').style.display = 'none';
  document.getElementById('listasModal').style.display = 'flex';
}

async function verFilmesVistos() {
  if (!currentUser) return;
  
  const lista = usuarios[currentUser].watched;
  const content = document.getElementById('minhaListaContent');
  const titulo = document.getElementById('listaTitulo');
  
  titulo.textContent = '🎬 Filmes Já Vistos';
  
  if (lista.length === 0) {
    content.innerHTML = '<p style="text-align: center; color: #aaa; padding: 40px;">Nenhum filme marcado como visto.<br><small>Marque filmes como vistos clicando em "Já Visto" nos detalhes dos filmes.</small></p>';
  } else {
    let listaHTML = '';
    
    for (const filmeId of lista) {
      let filmeInfo = `Filme ID: ${filmeId}`;
      
      // Tenta buscar informações do filme
      const obraSalva = catalogoCompleto.find(item => {
        const tmdb = JSON.parse(localStorage.getItem(`tmdb_${filmeId}`) || '{}');
        return tmdb.id == filmeId || item.titulo.includes(filmeId);
      });
      
      if (obraSalva) {
        filmeInfo = obraSalva.titulo;
      }
      
      listaHTML += `
          <div class="item-lista">
              <div class="info-wrapper">
                  ${imgTag}
                  <span class="nome-filme">${info.titulo}</span>
              </div>
              <div class="acoes-lista">
                  <button onclick="moverParaWatchlist('${filmeId}')" title="Ver Novamente"></button>
                  <button onclick="deletarDaLista('${filmeId}', 'watched')" class="btn-lixeira">🗑️</button>
              </div>
          </div>
      `;
    }
    
    content.innerHTML = listaHTML;
  }
  
  document.getElementById('perfilModal').style.display = 'none';
  document.getElementById('listasModal').style.display = 'flex';
}

function verMeusComentarios() {
  if (!currentUser) return;
  
  const comentarios = usuarios[currentUser].comentarios;
  const content = document.getElementById('minhaListaContent');
  const titulo = document.getElementById('listaTitulo');
  
  titulo.textContent = 'Meus Comentários';
  
  if (!comentarios || Object.keys(comentarios).length === 0) {
    content.innerHTML = '<p style="text-align: center; color: #aaa; padding: 40px;">Você ainda não fez nenhum comentário.<br><small>Comente nos filmes para ver seus comentários aqui.</small></p>';
  } else {
    content.innerHTML = Object.entries(comentarios).map(([filmeId, comment]) => `
      <div class="item-lista comentario-item">
        <div class="item-info">
          <strong>${comment.filmeTitulo}</strong>
          <div class="comment-rating-small">${'★'.repeat(comment.rating)}${'☆'.repeat(5-comment.rating)}</div>
          <div class="comment-text">${comment.text}</div>
          <small class="comment-date">${comment.date}</small>
        </div>
        <button onclick="deletarComentarioLista('${filmeId}')" title="Deletar comentário">🗑️</button>
      </div>
    `).join('');
  }
  
  document.getElementById('perfilModal').style.display = 'none';
  document.getElementById('listasModal').style.display = 'flex';
}

// Função auxiliar para mover entre listas
function moverParaWatchlist(filmeId) {
  if (!currentUser) return;
  
  // Remove dos vistos
  usuarios[currentUser].watched = usuarios[currentUser].watched.filter(id => id !== filmeId);
  
  // Adiciona na watchlist se não estiver lá
  if (!usuarios[currentUser].watchlist.includes(filmeId)) {
    usuarios[currentUser].watchlist.push(filmeId);
  }
  
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  verFilmesVistos();
  alert('Movido para "Ver Depois"! 👁️');
}

function deletarComentarioLista(filmeId) {
  if (!currentUser) return;
  
  if (confirm('Deseja deletar este comentário?')) {
    delete usuarios[currentUser].comentarios[filmeId];
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    verMeusComentarios();
  }
}

function fecharListas() {
  document.getElementById('listasModal').style.display = 'none';
}

// ======================================================
//  SCROLL DOS CARROSÉIS
// ======================================================

function scrollRight(id) {
  console.log("Mano passei pela setinha direita");
  document.getElementById(id).scrollBy({ left: 600, behavior: "smooth" });
}
function scrollLeftBtn(id) {
  console.log("Mano passei pela setinha esquerda");
  document.getElementById(id).scrollBy({ left: -600, behavior: "smooth" });
}

// ======================================================
//  BARRA DE BUSCA GLOBAL
// ======================================================

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

// Evento ao digitar
searchInput.addEventListener("input", async () => {
  const termo = searchInput.value.trim().toLowerCase();

  if (termo.length === 0) {
    searchResults.style.display = "none";
    return;
  }

  const encontrados = catalogoCompleto.filter(item =>
    item.titulo.toLowerCase().includes(termo)
  );

  searchResults.innerHTML = "";

  for (const item of encontrados.slice(0, 10)) {
    const tmdb = await buscarNoTMDB(item.titulo, item.ano || item.ano_inicio);

    const linha = document.createElement("div");
    linha.innerHTML = `
      <strong>${item.titulo}</strong><br>
      <small>${item.ano || ""}</small>
    `;
    linha.addEventListener("click", () => {
      abrirDetalhes(item, tmdb, tmdb?.id, "movie");
      searchResults.style.display = "none";
      searchInput.value = "";
    });

    searchResults.appendChild(linha);
  }

  searchResults.style.display = "block";
});

// Fecha resultados ao clicar fora
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-container")) {
    searchResults.style.display = "none";
  }
});

// ======================================================
//  BUSCA NOME E FOTO PELO ID
// ======================================================
async function buscarInfoParaLista(id) {
    // 1. Tenta achar no catálogo local (seus JSONs)
    const local = catalogoCompleto.find(item => item.titulo === id || item.id === id);
    if (local) {
        return {
            titulo: local.titulo,
            poster: local.poster_path ? IMG_URL + local.poster_path : "imagem/sem-foto.jpg" // Ajuste o caminho se tiver uma imagem padrão
        };
    }
    try {
        let url = `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=pt-BR`;
        let resp = await fetch(url);
        
        if (!resp.ok) {
            url = `${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=pt-BR`;
            resp = await fetch(url);
        }

        if (resp.ok) {
            const data = await resp.json();
            return {
                titulo: data.title || data.name,
                poster: data.poster_path ? IMG_URL + data.poster_path : "https://via.placeholder.com/50x75?text=S/Foto"
            };
        }
    } catch (error) {
        console.log("Erro ao buscar info do filme:", id);
    }

    return { titulo: "Item Indisponível (ID: " + id + ")", poster: null };
}

// ======================================================
//  MINHA LISTA - COM FOTO E NOME
// ======================================================
async function verMinhaLista() {
    if (!currentUser) return;
    
    const lista = usuarios[currentUser].watchlist;
    const content = document.getElementById('minhaListaContent');
    const titulo = document.getElementById('listaTitulo');
    
    titulo.textContent = 'Minha Lista - Ver Depois';
    content.innerHTML = '<p style="text-align:center">Carregando seus filmes...</p>';
    
    if (lista.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Sua lista está vazia.</p>';
        document.getElementById('perfilModal').style.display = 'none';
        document.getElementById('listasModal').style.display = 'flex';
        return;
    }

    let listaHTML = '';
    
    for (const filmeId of lista) {
        const info = await buscarInfoParaLista(filmeId);
        
        const imgTag = info.poster ? `<img src="${info.poster}" class="thumb-lista">` : '';

        listaHTML += `
            <div class="item-lista">
                <div class="info-wrapper">
                    ${imgTag}
                    <span class="nome-filme">${info.titulo}</span>
                </div>
                <button onclick="deletarDaLista('${filmeId}', 'watchlist')" class="btn-lixeira" title="Remover">🗑️</button>
            </div>
        `;
    }
    
    content.innerHTML = listaHTML;
    document.getElementById('perfilModal').style.display = 'none';
    document.getElementById('listasModal').style.display = 'flex';
}

// ======================================================
//  FILMES JÁ VISTOS - COM FOTO E NOME
// ======================================================
async function verFilmesVistos() {
    if (!currentUser) return;
    
    const lista = usuarios[currentUser].watched;
    const content = document.getElementById('minhaListaContent');
    const titulo = document.getElementById('listaTitulo');
    
    titulo.textContent = 'Filmes Já Vistos';
    content.innerHTML = '<p style="text-align:center">Carregando seus filmes...</p>';
    
    if (lista.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Nenhum filme marcado como visto.</p>';
        document.getElementById('perfilModal').style.display = 'none';
        document.getElementById('listasModal').style.display = 'flex';
        return;
    }

    let listaHTML = '';
    
    for (const filmeId of lista) {
        const info = await buscarInfoParaLista(filmeId);
        const imgTag = info.poster ? `<img src="${info.poster}" class="thumb-lista">` : '';

        listaHTML += `
            <div class="item-lista">
                <div class="info-wrapper">
                    ${imgTag}
                    <span class="nome-filme">${info.titulo}</span>
                </div>
                <div class="acoes-lista">
                    <button onclick="moverParaWatchlist('${filmeId}')" title="Ver Novamente"></button>
                    <button onclick="deletarDaLista('${filmeId}', 'watched')" class="btn-lixeira">🗑️</button>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = listaHTML;
    document.getElementById('perfilModal').style.display = 'none';
    document.getElementById('listasModal').style.display = 'flex';
}

// ======================================================
//  FUNÇÕES AUXILIARES
// ======================================================

function gerarEstrelas(nota) {
  const estrelasCheias = Math.floor(nota);
  const temMeia = nota % 1 >= 0.5;
  let html = '';
  
  for (let i = 1; i <= 5; i++) {
    if (i <= estrelasCheias) {
      html += '<span class="estrela cheia">★</span>';
    } else if (i === estrelasCheias + 1 && temMeia) {
      html += '<span class="estrela meia">★</span>';
    } else {
      html += '<span class="estrela vazia">★</span>';
    }
  }
  return html;
}

// Botão fechar popup
document.getElementById("closePopup").addEventListener("click", () => {
  document.getElementById("popup").style.display = "none";
  document.getElementById("trailerFrame").src = "";
});

// ======================================================
//  CARREGAR JSONs PARA BUSCA GLOBAL
// ======================================================

let catalogoCompleto = [];

async function carregarCatalogoParaBusca() {
  for (const path of Object.values(JSON_PATHS)) {
    const resp = await fetch(path);
    const data = await resp.json();
    catalogoCompleto.push(...data);
  }
}

carregarCatalogoParaBusca();

// ======================================================
//  INICIALIZAÇÃO DO SISTEMA
// ======================================================

// Carregar usuário atual ao iniciar
document.addEventListener('DOMContentLoaded', function() {
  currentUser = localStorage.getItem('currentUser');
  usuarios = JSON.parse(localStorage.getItem('usuarios') || '{}');
  atualizarEstadoLogin();
  
  // Event listeners para fechar modais
  document.getElementById('loginModal').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.getElementById('perfilModal').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.getElementById('listasModal').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.getElementById('popup').addEventListener('click', function(e) {
    if (e.target === this) {
      this.style.display = 'none';
      document.getElementById('trailerFrame').src = "";
    }
  });
});

// ======================================================
//  INICIALIZAR O CATÁLOGO AO ABRIR O SITE
// ======================================================

carregarCatalogo();