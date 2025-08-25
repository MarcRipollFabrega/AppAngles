// Aquest fitxer conté tota la lògica del qüestionari, separada de l'arxiu principal.

/**
 * Funció per reproduir una paraula o frase utilitzant Text-to-Speech.
 * @param {string} word - La paraula o frase a reproduir.
 * @param {string} languageCode - El codi de l'idioma a utilitzar (p.ex., "en-US", "es-ES").
 */
function playWord(word, languageCode) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = languageCode;

    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    for (let i = 0; i < voices.length; i++) {
      if (voices[i].lang.startsWith(languageCode.split("-")[0])) {
        if (voices[i].name.toLowerCase().includes("female")) {
          selectedVoice = voices[i];
          break; // Prioriza la voz femenina y sale del bucle
        }
        if (!selectedVoice) {
          selectedVoice = voices[i]; // Guarda la primera voz del idioma como fallback
        }
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    speechSynthesis.speak(utterance);
  } else {
    console.error(
      "La API de Text-to-Speech no es compatible con este navegador."
    );
  }
}

/**
 * Funció principal que inicialitza el qüestionari.
 * @param {object} supabaseClient - El client de Supabase inicialitzat.
 * @param {function} manejarAlerta - La funció per mostrar alertes.
 */
export async function initQuiz(supabaseClient, manejarAlerta) {
  const _supabase = supabaseClient;

  // Referències als elements del DOM
  const moduleSelectionDiv = document.getElementById("module-selection");
  const lessonsContainer = document.getElementById("lessons-container");
  const quizContainer = document.getElementById("quiz-container");
  const questionElement = document.getElementById("question");
  const optionsContainer = document.getElementById("options");
  const nextButton = document.getElementById("next-button");
  const feedbackElement = document.getElementById("feedback");
  const resultsContainer = document.getElementById("results-container");
  const resultsList = document.getElementById("results-list");
  const restartButton = document.getElementById("restart-button");
  const progressContainer = document.getElementById("progress-container");
  const progressList = document.getElementById("progress-list");

  // NOU: Assegurem que el contenidor de lliçons estigui ocult a l'inici
  lessonsContainer.style.display = "none";

  // VERIFICACIÓ: Assegurem que tots els elements existeixen.
  if (
    !moduleSelectionDiv ||
    !lessonsContainer ||
    !quizContainer ||
    !questionElement ||
    !optionsContainer ||
    !nextButton ||
    !feedbackElement ||
    !resultsContainer ||
    !resultsList ||
    !restartButton ||
    !progressContainer ||
    !progressList
  ) {
    console.error(
      "Un o més elements del DOM del qüestionari no es van trobar. Assegura't que el teu HTML té els IDs correctes."
    );
    return;
  }

  let currentModuleKey = null;
  let currentModuleData = null;
  let currentQuestionIndex = 0;
  let correctAnswers = 0;
  let currentQuestion;
  let currentUser = null; // Variable per guardar l'usuari actual

  const CORRECT_THRESHOLD = 3; // NOU: Llindar de 3 respostes correctes
  const ONE_MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

  /**
   * Obté l'usuari actual logat a Supabase.
   */
  async function getCurrentUser() {
    const {
      data: { user },
    } = await _supabase.auth.getUser();
    if (!user) {
      manejarAlerta("No hi ha cap usuari autenticat.", "error");
      return null;
    }
    return user;
  }

  /**
   * Funció per actualitzar el progrés de l'usuari a la base de dades.
   */
  /**
   * Funció per actualitzar el progrés de l'usuari a la base de dades.
   */
  async function updateProgress(userId, wordId, isCorrect) {
    if (!userId || !wordId) {
      console.error(
        "No es pot actualitzar el progrés: l'ID d'usuari o de la paraula no estan definits."
      );
      return;
    }

    const { data: existingProgress, error: fetchError } = await _supabase
      .from("progres_usuari")
      .select("vegades_correctes, vegades_incorrectes, estat") // També busquem l'estat per una millor lògica
      .eq("id_usuari", userId)
      .eq("id_paraula", wordId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error al buscar el progrés existent:", fetchError);
      return;
    }

    // Si no hi ha progrés preexistent, creem els valors per defecte
    const currentCorrect = existingProgress
      ? existingProgress.vegades_correctes
      : 0;
    const currentIncorrect = existingProgress
      ? existingProgress.vegades_incorrectes
      : 0;

    let newCorrect = currentCorrect;
    let newIncorrect = currentIncorrect;

    if (isCorrect) {
      // Si la resposta és CORRECTA:
      if (currentIncorrect > 0) {
        // Si hi ha errors acumulats, els reduïm abans de sumar respostes correctes
        newIncorrect = currentIncorrect - 1;
      } else {
        // Si no hi ha errors, sumem una resposta correcta
        newCorrect = currentCorrect + 1;
      }
    } else {
      // Si la resposta és INCORRECTA:
      // Sempre sumem un error
      newIncorrect = currentIncorrect + 1;
      // Si l'estat era 'apresa', el revertim a 'practicant'
      if (existingProgress?.estat === "apresa") {
        const { error: updateStateError } = await _supabase
          .from("progres_usuari")
          .update({ estat: "practicant", vegades_correctes: 0 })
          .eq("id_usuari", userId)
          .eq("id_paraula", wordId);
        if (updateStateError) {
          console.error("Error al actualitzar l'estat:", updateStateError);
        }
      }
    }

    // La lògica de l'estat 'apresa' es basa en el comptador de respostes correctes
    const newState = newCorrect >= CORRECT_THRESHOLD ? "apresa" : "practicant";

    // Si la paraula arriba a 'apresa', resetejem el comptador d'errors.
    if (newState === "apresa") {
      newIncorrect = 0;
    }

    // Operació d'actualització o inserció a la base de dades
    const dataToUpdate = {
      vegades_correctes: newCorrect,
      vegades_incorrectes: newIncorrect,
      estat: newState,
      data_ultima_practica: new Date().toISOString(),
    };

    if (existingProgress) {
      const { error: updateError } = await _supabase
        .from("progres_usuari")
        .update(dataToUpdate)
        .eq("id_usuari", userId)
        .eq("id_paraula", wordId);

      if (updateError) {
        console.error("Error al actualitzar el progrés:", updateError);
      }
    } else {
      const { error: insertError } = await _supabase
        .from("progres_usuari")
        .insert([
          {
            ...dataToUpdate,
            id_usuari: userId,
            id_paraula: wordId,
          },
        ]);

      if (insertError) {
        console.error("Error al insertar el progrés:", insertError);
      }
    }
  }

  /**
   * Obté la llista de nivells (A1, B2, etc.) únics de la taula 'vocabulari'.
   */
  async function fetchLevelsFromSupabase() {
    const { data, error } = await _supabase
      .from("vocabulari")
      .select("nivel_base")
      .order("nivel_base", { ascending: true });

    if (error) {
      console.error("Error al obtener los niveles:", error.message);
      return [];
    }

    const uniqueLevels = [...new Set(data.map((item) => item.nivel_base))];
    return uniqueLevels;
  }

  /**
   * Obté la llista de temes per a un nivell específic.
   */
  async function fetchTopicsFromSupabase(level) {
    let allTopics = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await _supabase
        .from("vocabulari")
        .select("tema")
        .eq("nivel_base", level)
        .range(offset, offset + limit - 1)
        .order("tema", { ascending: true });

      if (error) {
        console.error(
          `Error al obtener los temas para ${level}:`,
          error.message
        );
        break; // Sortim del bucle en cas d'error
      }

      // Afegeix les dades rebudes al teu array de tots els temes
      allTopics.push(...data);

      // Si la quantitat de dades rebuda és menor que el límit, vol dir que hem arribat al final
      if (data.length < limit) {
        break;
      }

      offset += limit;
    }

    const uniqueTopics = [...new Set(allTopics.map((item) => item.tema))];
    return uniqueTopics;
  }

  /**
   * Obté una explicació específica de la taula 'explicaciones'.
   * @param {string} nivel - El nivell (p.ex., "A1").
   * @param {string} tema - El tema (p.ex., "Verbos").
   */
  async function obtenerExplicacion(nivel, tema) {
    const { data: explicacion, error } = await _supabase
      .from("explicaciones")
      .select("*")
      .eq("nivel_base", nivel)
      .eq("tema", tema)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error al obtener la explicación:", error);
      return null;
    }

    return explicacion;
  }

  /**
   * Obté totes les paraules i dades per a un mòdul específic.
   * @param {string} level - El nivell del mòdul (p.ex. "A1").
   * @param {string} topic - El tema del mòdul (p.ex. "Adjetivos").
   */
  async function fetchVocabularyAndLesson(level, topic) {
    const { data: vocabData, error: vocabError } = await _supabase
      .from("vocabulari")
      .select("*")
      .eq("nivel_base", level)
      .eq("tema", topic)
      .order("id", { ascending: true });

    if (vocabError) {
      console.error("Error al obtener el vocabulario:", vocabError.message);
      return [];
    }

    const explicacion = await obtenerExplicacion(level, topic);
    const fullModuleData = vocabData.map((vocabItem) => ({
      ...vocabItem,
      explicaciones: explicacion,
    }));

    return fullModuleData;
  }

  /**
   * Omple la selecció de mòduls per nivell.
   */
  async function populateModuleSelection() {
    const availableLevels = await fetchLevelsFromSupabase();
    moduleSelectionDiv.innerHTML = "<h2>Selecciona un nivel:</h2>";

    quizContainer.style.display = "none";
    lessonsContainer.style.display = "none";
    resultsContainer.style.display = "none";
    moduleSelectionDiv.style.display = "block";

    availableLevels.forEach((levelName) => {
      const button = document.createElement("button");
      button.textContent = levelName;
      button.addEventListener("click", () => {
        populateTopicSelection(levelName);
      });
      moduleSelectionDiv.appendChild(button);
    });
  }

  /**
   * Omple la selecció de temes per a un nivell concret.
   */
  async function populateTopicSelection(levelName) {
    // Obtenim els temes de la base de dades
    const availableTopics = await fetchTopicsFromSupabase(levelName);

    // 1. Netejar completament el contenidor
    // Aquesta línia és clau per assegurar-se que no hi hagi contingut anterior
    moduleSelectionDiv.innerHTML = "";

    // 2. Afegir l'encapçalament i el botó de "Tornar"
    const heading = document.createElement("h2");
    heading.textContent = `Selecciona un tema para ${levelName}:`;
    moduleSelectionDiv.appendChild(heading);

    const backButton = document.createElement("button");
    backButton.textContent = "Volver a Niveles";
    backButton.addEventListener("click", populateModuleSelection);
    moduleSelectionDiv.appendChild(backButton);

    // 3. Afegir tots els botons dels temes
    availableTopics.forEach((topicName) => {
      const button = document.createElement("button");
      button.textContent = topicName;
      button.addEventListener("click", async () => {
        loadModule(`${levelName}${topicName}`);
      });
      // Afegeix cada botó al final del contenidor
      moduleSelectionDiv.appendChild(button);
    });
  }

  /**
   * Funció per carregar i mostrar el contingut de les lliçons a la barra lateral.
   * @param {string} title - El títol de la lliçó.
   * @param {string} content - El contingut de la lliçó en format HTML.
   */
  async function cargarLeccion(title, content) {
    const lessonsListContainer = document.getElementById("lessons-list");
    lessonsListContainer.innerHTML = "";

    if (title && content) {
      const titleElement = document.createElement("h3");
      titleElement.textContent = title;
      lessonsListContainer.appendChild(titleElement);
      lessonsListContainer.innerHTML += content;
    } else {
      lessonsListContainer.innerHTML = `<p>No s'ha trobat contingut per a aquesta lliçó.</p>`;
    }
  }

  /**
   * Prepara les dades del qüestionari basant-se en el progrés de l'usuari a la base de dades.
   * @param {string} level - El nivell del mòdul (p.ex. "A1").
   * @param {string} topic - El tema del mòdul (p.ex. "Adjetivos").
   */
  async function prepareModuleData(level, topic) {
    if (!currentUser) {
      manejarAlerta("Inicia sessió per veure el teu progrés.", "error");
      return [];
    }

    // 1. Obtenir totes les paraules del mòdul
    const { data: vocabData, error: vocabError } = await _supabase
      .from("vocabulari")
      .select("id, english, spanish, example, nivel_base, example_spanish")
      .eq("nivel_base", level)
      .eq("tema", topic);

    if (vocabError) {
      console.error("Error al obtener vocabulario:", vocabError);
      return [];
    }

    const wordIds = vocabData.map((word) => word.id);

    // 2. Obtenir el progrés de l'usuari per a aquestes paraules
    const { data: progressData, error: progressError } = await _supabase
      .from("progres_usuari")
      .select(
        "id_paraula, vegades_correctes, vegades_incorrectes, estat, data_ultima_practica"
      )
      .eq("id_usuari", currentUser.id)
      .in("id_paraula", wordIds);

    if (progressError && progressError.code !== "PGRST116") {
      console.error("Error al obtener el progreso:", progressError);
      return [];
    }

    // Convertir l'array de progrés en un mapa per a un accés ràpid
    const progressMap = new Map(
      progressData.map((item) => [item.id_paraula, item])
    );

    const allWords = vocabData.map((word) => {
      // Obtenim l'estat actual del progrés
      const progress = progressMap.get(word.id) || {
        vegades_correctes: 0,
        vegades_incorrectes: 0,
        estat: "nova",
      };

      // Definim la direcció de la pregunta segons l'estat de la paraula
      const direction = progress.estat === "apresa" ? "es-en" : "en-es";

      return {
        ...word,
        progress,
        direction, // Afegeix la nova propietat de direcció
      };
    });

    // 3. Implementar la lògica de prioritat
    const noPracticed = allWords.filter(
      (word) => word.progress.estat === "nova"
    );
    const needsPractice = allWords.filter(
      (word) =>
        word.progress.estat !== "nova" && word.progress.vegades_incorrectes > 0
    );

    const learnedWords = allWords.filter(
      (word) => word.progress.estat === "apresa"
    );
    const readyForReview = learnedWords.filter((word) => {
      const lastPracticed = new Date(
        word.progress.data_ultima_practica
      ).getTime();
      return Date.now() - lastPracticed > ONE_MONTH_IN_MS;
    });

    const rest = allWords.filter(
      (word) =>
        word.progress.estat === "practicant" &&
        word.progress.vegades_incorrectes === 0
    );

    needsPractice.sort(
      (a, b) => b.progress.vegades_incorrectes - a.progress.vegades_incorrectes
    );

    const shuffledRest = rest.sort(() => Math.random() - 0.5);
    const shuffledReview = readyForReview.sort(() => Math.random() - 0.5);

    return [
      ...noPracticed,
      ...needsPractice,
      ...shuffledRest,
      ...shuffledReview,
    ];
  }

  async function loadModule(moduleKey) {
    currentModuleKey = moduleKey;

    const [level, topic] = moduleKey
      .match(/^(A[1-2]|B[1-2]|C[1-2])(.*)$/)
      .slice(1);

    const explicacion = await obtenerExplicacion(level, topic);
    if (explicacion) {
      cargarLeccion(explicacion.titulo_leccion, explicacion.contenido_html);
    } else {
      cargarLeccion(
        "Sense Explicació",
        "<p>No hi ha una lliçó disponible per a aquest mòdul.</p>"
      );
    }

    currentModuleData = await prepareModuleData(level, topic);
    currentQuestionIndex = 0;
    correctAnswers = 0;

    moduleSelectionDiv.style.display = "none";
    lessonsContainer.style.display = "block";
    resultsContainer.style.display = "none";
    quizContainer.style.display = "block";

    loadQuestion();
  }

function loadQuestion() {
  if (currentQuestionIndex < currentModuleData.length) {
    currentQuestion = currentModuleData[currentQuestionIndex];
    optionsContainer.innerHTML = "";
    feedbackElement.textContent = "";

    let questionText,
      exampleText,
      wordToPlay,
      exampleToPlay,
      languageCode,
      correctAnswer,
      allOptions;

    if (currentQuestion.direction === "en-es") {
      // Nivel 1: Traducción de inglés a español
      questionText = `¿Cuál es la traducción de "${currentQuestion.english}"?`;
      exampleText = currentQuestion.example;
      wordToPlay = currentQuestion.english;
      exampleToPlay = currentQuestion.example;
      languageCode = "en-US";
      correctAnswer = currentQuestion.spanish;
      allOptions = currentModuleData.map((item) => item.spanish);
    } else {
      // Nivel 2: Traducción de español a inglés (ya aprendida)
      questionText = `¿Cuál es la traducción de "${currentQuestion.spanish}"?`;
      exampleText = currentQuestion.example_spanish;
      wordToPlay = currentQuestion.spanish;
      exampleToPlay = currentQuestion.example_spanish;
      languageCode = "es-ES";
      correctAnswer = currentQuestion.english;
      allOptions = currentModuleData.map((item) => item.english);
    }

    // Renderizar la pregunta y el ejemplo
    questionElement.textContent = questionText;
    const exampleElement = document.createElement("p");
    exampleElement.textContent = `Ejemplo: ${exampleText}`;
    questionElement.appendChild(document.createElement("br"));
    questionElement.appendChild(exampleElement);

    // Reproducir primero la palabra principal y luego el ejemplo
    playWord(wordToPlay, languageCode);
    setTimeout(() => {
      playWord(exampleToPlay, languageCode);
    }, 500); // Pequeño retraso para que suene más natural

    // Generar opciones y renderizar los botones
    const randomOptions = new Set();
    randomOptions.add(correctAnswer);
    while (randomOptions.size < 4) {
      const randomIndex = Math.floor(Math.random() * allOptions.length);
      const randomWord = allOptions[randomIndex];
      randomOptions.add(randomWord);
    }
    const optionsArray = Array.from(randomOptions).sort(
      () => Math.random() - 0.5
    );

    optionsArray.forEach((option) => {
      const button = document.createElement("button");
      button.textContent = option;
      button.addEventListener("click", () =>
        checkAnswer(option, correctAnswer)
      );
      optionsContainer.appendChild(button);
    });
  } else {
    showModuleResults();
  }
}

  async function checkAnswer(selectedAnswer, correctAnswer) {
    const buttons = optionsContainer.querySelectorAll("button");
    buttons.forEach((button) => {
      button.disabled = true;
      if (button.textContent === correctAnswer) {
        button.style.backgroundColor = "#5cb85c";
        button.style.color = "white";
      } else if (button.textContent === selectedAnswer) {
        button.style.backgroundColor = "#d9534f";
        button.style.color = "white";
      }
    });

    const isCorrect = selectedAnswer === correctAnswer;

    if (currentUser) {
      if (isCorrect) {
        await updateProgress(currentUser.id, currentQuestion.id, true);
      } else {
        await updateProgress(currentUser.id, currentQuestion.id, false);
      }
      await updateProgressDisplay();
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < currentModuleData.length) {
      setTimeout(loadQuestion, 1500);
    } else {
      setTimeout(showModuleResults, 1500);
    }
  }

  function showModuleResults() {
    quizContainer.style.display = "none";
    resultsContainer.style.display = "block";
    resultsList.innerHTML = "";

    const totalQuestions = currentModuleData.length;
    const percentage = (correctAnswers / totalQuestions) * 100;
    const listItem = document.createElement("li");
    listItem.textContent = `Resultados del módulo ${currentModuleKey}: Obtuviste ${correctAnswers} de ${totalQuestions} (${percentage.toFixed(
      2
    )}%) respuestas correctas.`;
    resultsList.appendChild(listItem);

    populateModuleSelection();
  }

  function restartQuiz() {
    resultsContainer.style.display = "none";
    moduleSelectionDiv.style.display = "block";
    currentModuleKey = null;
    currentModuleData = null;
  }

  async function updateProgressDisplay() {
    progressList.innerHTML = ""; // Neteja la llista

    if (!currentUser) {
      progressList.innerHTML =
        "<li>Inicia sessió per veure el teu progrés.</li>";
      return;
    }

    const { data: userProgress, error } = await _supabase
      .from("progres_usuari")
      .select(
        "vegades_correctes, vegades_incorrectes, estat, vocabulari(english, spanish)"
      )
      .eq("id_usuari", currentUser.id)
      .order("data_ultima_practica", { ascending: false });

    if (error) {
      console.error("Error al obtener el progreso del usuario:", error);
      progressList.innerHTML = "<li>Error en carregar el progrés.</li>";
      return;
    }

    if (userProgress.length === 0) {
      progressList.innerHTML = "<li>Encara no has practicat cap paraula.</li>";
      return;
    }

    const learnedWords = userProgress.filter((item) => item.estat === "apresa");
    if (learnedWords.length > 0) {
      progressList.innerHTML += "<h3>Paraules apreses:</h3>";
      learnedWords.forEach((item) => {
        progressList.innerHTML += `
                      <li>
                          <strong>${item.vocabulari.english}</strong> (${item.vocabulari.spanish})
                          <br> Correctes: ${item.vegades_correctes} | Incorrectes: ${item.vegades_incorrectes}
                      </li>
                  `;
      });
    }

    const needsPracticeWords = userProgress.filter(
      (item) => item.estat !== "apresa"
    );
    if (needsPracticeWords.length > 0) {
      progressList.innerHTML += "<h3>Paraules que necessiten pràctica:</h3>";
      needsPracticeWords.forEach((item) => {
        progressList.innerHTML += `
                      <li>
                          <strong>${item.vocabulari.english}</strong> (${item.vocabulari.spanish})
                          <br> Correctes: ${item.vegades_correctes} | Incorrectes: ${item.vegades_incorrectes}
                      </li>
                  `;
      });
    }
  }
  // Afegim els listeners d'esdeveniments
  nextButton.addEventListener("click", loadQuestion);
  restartButton.addEventListener("click", restartQuiz);

  // Càrrega inicial del qüestionari
  currentUser = await getCurrentUser();
  populateModuleSelection();
  updateProgressDisplay();
}
