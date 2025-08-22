// Aquest fitxer conté tota la lògica del qüestionari, separada de l'arxiu principal.

/**
 * Funció per reproduir una paraula o frase en anglès utilitzant Text-to-Speech.
 * @param {string} word - La paraula o frase a reproduir.
 */
function playWord(word) {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    let englishVoice = null;
    for (let i = 0; i < voices.length; i++) {
      if (voices[i].lang.startsWith("en")) {
        englishVoice = voices[i];
        if (voices[i].name.toLowerCase().includes("female")) {
          englishVoice = voices[i];
          break;
        }
        if (!englishVoice) {
          englishVoice = voices[i];
        }
      }
    }

    if (englishVoice) {
      utterance.voice = englishVoice;
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

  const CORRECT_THRESHOLD = 5; // NOU: Llindar de 5 respostes correctes
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
  async function updateProgress(userId, wordId, isCorrect) {
    if (!userId || !wordId) {
      console.error(
        "No es pot actualitzar el progrés: l'ID d'usuari o de la paraula no estan definits."
      );
      return;
    }

    const { data: existingProgress, error: fetchError } = await _supabase
      .from("progres_usuari")
      .select("vegades_correctes, vegades_incorrectes")
      .eq("id_usuari", userId)
      .eq("id_paraula", wordId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error al buscar el progrés existent:", fetchError);
      return;
    }

    const newCorrect = existingProgress
      ? existingProgress.vegades_correctes + (isCorrect ? 1 : 0)
      : isCorrect
      ? 1
      : 0;
    const newIncorrect = existingProgress
      ? existingProgress.vegades_incorrectes + (isCorrect ? 0 : 1)
      : isCorrect
      ? 0
      : 1;

    const newState = newCorrect >= CORRECT_THRESHOLD ? "apresa" : "practicant";
    const finalIncorrect = newCorrect >= CORRECT_THRESHOLD ? 0 : newIncorrect;

    if (existingProgress) {
      const { error: updateError } = await _supabase
        .from("progres_usuari")
        .update({
          vegades_correctes: newCorrect,
          vegades_incorrectes: finalIncorrect,
          estat: newState,
          data_ultima_practica: new Date().toISOString(),
        })
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
            id_usuari: userId,
            id_paraula: wordId,
            vegades_correctes: newCorrect,
            vegades_incorrectes: finalIncorrect,
            estat: newState,
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
    const { data, error } = await _supabase
      .from("vocabulari")
      .select("tema")
      .eq("nivel_base", level)
      .order("tema", { ascending: true });

    if (error) {
      console.error(`Error al obtener los temas para ${level}:`, error.message);
      return [];
    }

    const uniqueTopics = [...new Set(data.map((item) => item.tema))];
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
    const availableTopics = await fetchTopicsFromSupabase(levelName);
    moduleSelectionDiv.innerHTML = `<h2>Selecciona un tema para ${levelName}:</h2>`;

    const backButton = document.createElement("button");
    backButton.textContent = "Volver a Niveles";
    backButton.addEventListener("click", populateModuleSelection);
    moduleSelectionDiv.appendChild(backButton);

    availableTopics.forEach((topicName) => {
      const button = document.createElement("button");
      button.textContent = topicName;

      button.addEventListener("click", async () => {
        loadModule(`${levelName}${topicName}`);
      });
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
      .select("id, english, spanish, example, nivel_base")
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
      return {
        ...word,
        progress: progressMap.get(word.id) || {
          vegades_correctes: 0,
          vegades_incorrectes: 0,
          estat: "nova",
        },
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
      questionElement.textContent = `¿Cuál es la traducción de "${currentQuestion.english}"?`;

      const exampleElement = document.createElement("p");
      exampleElement.textContent = `Ejemplo: ${currentQuestion.example}`;
      questionElement.appendChild(document.createElement("br"));
      questionElement.appendChild(exampleElement);

      playWord(currentQuestion.example);

      optionsContainer.innerHTML = "";

      const correctAnswer = currentQuestion.spanish;
      const allSpanishWords = currentModuleData.map((item) => item.spanish);
      const randomOptions = new Set();
      randomOptions.add(correctAnswer);

      while (randomOptions.size < 4) {
        const randomIndex = Math.floor(Math.random() * allSpanishWords.length);
        const randomWord = allSpanishWords[randomIndex];
        randomOptions.add(randomWord);
      }

      const optionsArray = Array.from(randomOptions);
      optionsArray.sort(() => Math.random() - 0.5);

      optionsArray.forEach((option) => {
        const button = document.createElement("button");
        button.textContent = option;
        button.addEventListener("click", () =>
          checkAnswer(option, correctAnswer)
        );
        optionsContainer.appendChild(button);
      });

      feedbackElement.textContent = "";
      playWord(currentQuestion.english);
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
