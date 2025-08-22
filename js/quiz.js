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
  let learnedWords = JSON.parse(localStorage.getItem("learnedWords")) || {};
  let practiceNeeded = JSON.parse(localStorage.getItem("practiceNeeded")) || {};
  let moduleProgress = JSON.parse(localStorage.getItem("moduleProgress")) || {};
  let currentQuestion;
  let selectedModuleToRetry = null;

  const CORRECT_THRESHOLD = 3;
  const PRACTICE_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

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
   * Obté totes les paraules i dades per a un mòdul específic.
   * @param {string} level - El nivell del mòdul (p.ex. "A1").
   * @param {string} topic - El tema del mòdul (p.ex. "Adjetivos").
   */
  async function fetchVocabularyAndLesson(level, topic) {
    // Primera crida per obtenir el vocabulari, filtrant per `nivel_base` i `tema`
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

    // NOU: Combina les dades del vocabulari amb la primera lliçó trobada
    const { data: lessonData, error: lessonError } = await _supabase
      .from("explicaciones")
      .select("titulo_leccion, contenido_html")
      .eq("nivel_base", level)
      .eq("tema", topic)
      .order("id", { ascending: true });

    if (lessonError) {
      console.error("Error al obtener la lección:", lessonError.message);
      return [];
    }

    const fullModuleData = vocabData.map((vocabItem) => ({
      ...vocabItem,
      explicaciones: lessonData.length > 0 ? lessonData[0] : null,
    }));

    return fullModuleData;
  }

  /**
   * Omple la selecció de mòduls per nivell.
   */
  async function populateModuleSelection() {
    const availableLevels = await fetchLevelsFromSupabase();
    moduleSelectionDiv.innerHTML = "<h2>Selecciona un nivel:</h2>";

    // NOU: Amaguem els altres contenidors quan mostrem la selecció de mòduls
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

    // Botó per tornar al menú de nivells
    const backButton = document.createElement("button");
    backButton.textContent = "Volver a Niveles";
    backButton.addEventListener("click", populateModuleSelection);
    moduleSelectionDiv.appendChild(backButton);

    availableTopics.forEach((topicName) => {
      const button = document.createElement("button");
      button.textContent = topicName;
      const status =
        moduleProgress[`${levelName}${topicName}`] === "learned"
          ? " (Aprendido)"
          : "";
      button.textContent += status;

      button.addEventListener("click", async () => {
        const fullModuleData = await fetchVocabularyAndLesson(
          levelName,
          topicName
        );

        if (fullModuleData && fullModuleData.length > 0) {
          // Crida per carregar el mòdul
          loadModule(`${levelName}${topicName}`, fullModuleData);

          // També carreguem el contingut de la lliçó
          const lessonTitle = fullModuleData[0].explicaciones.titulo_leccion;
          const lessonContent = fullModuleData[0].explicaciones.contenido_html;
          cargarLeccion(lessonTitle, lessonContent);
        } else {
          manejarAlerta("No s'han trobat dades per a aquest mòdul.", "error");
        }
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
    lessonsListContainer.innerHTML = ""; // Neteja el contingut anterior

    if (title && content) {
      const titleElement = document.createElement("h3");
      titleElement.textContent = title;
      lessonsListContainer.appendChild(titleElement);
      lessonsListContainer.innerHTML += content;
    } else {
      lessonsListContainer.innerHTML = `<p>No s'ha trobat contingut per a aquesta lliçó.</p>`;
    }
  }

  function loadModule(moduleKey, module) {
    currentModuleKey = moduleKey;
    // Preparem només les dades del qüestionari
    const quizData = module.map((item) => ({
      english: item.english,
      spanish: item.spanish,
      example: item.example,
      nivel: item.nivel,
    }));
    currentModuleData = prepareModuleData(quizData);
    currentQuestionIndex = 0;
    correctAnswers = 0;

    // NOU: Amaguem els altres contenidors i mostrem el del qüestionari
    moduleSelectionDiv.style.display = "none";
    lessonsContainer.style.display = "block";
    resultsContainer.style.display = "none";
    quizContainer.style.display = "block";

    loadQuestion();
  }

  function prepareModuleData(module) {
    return module
      .map((item) => {
        const learnedInfo = learnedWords[item.english] || {
          correctCount: 0,
          lastPracticed: 0,
        };
        const practiceInfo = practiceNeeded[item.english] || {
          incorrectCount: 0,
          lastPracticed: 0,
        };
        return { ...item, learnedInfo, practiceInfo };
      })
      .sort((a, b) => {
        if (
          b.practiceInfo.incorrectCount - a.practiceInfo.incorrectCount !==
          0
        ) {
          return b.practiceInfo.incorrectCount - a.practiceInfo.incorrectCount;
        }
        const timeSinceAPracticed = Date.now() - a.learnedInfo.lastPracticed;
        const timeSinceBPracticed = Date.now() - b.learnedInfo.lastPracticed;
        if (
          (a.learnedInfo.correctCount >= CORRECT_THRESHOLD &&
            timeSinceAPracticed > PRACTICE_THRESHOLD) ||
          (b.learnedInfo.correctCount >= CORRECT_THRESHOLD &&
            timeSinceBPracticed > PRACTICE_THRESHOLD)
        ) {
          return timeSinceAPracticed - timeSinceBPracticed;
        }
        return Math.random() - 0.5;
      });
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

  function checkAnswer(selectedAnswer, correctAnswer) {
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

    const now = Date.now();
    if (selectedAnswer === correctAnswer) {
      correctAnswers++;
      const englishWord = currentQuestion.english;
      learnedWords[englishWord] = {
        correctCount: (learnedWords[englishWord]?.correctCount || 0) + 1,
        lastPracticed: now,
      };
      delete practiceNeeded[englishWord];
    } else {
      const englishWord = currentQuestion.english;
      practiceNeeded[englishWord] = {
        incorrectCount: (practiceNeeded[englishWord]?.incorrectCount || 0) + 1,
        lastPracticed: now,
      };
    }

    localStorage.setItem("learnedWords", JSON.stringify(learnedWords));
    localStorage.setItem("practiceNeeded", JSON.stringify(practiceNeeded));

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

    checkModuleLearnedStatus();
  }

  function checkModuleLearnedStatus() {
    const allLearned = currentModuleData.every(
      (item) =>
        (learnedWords[item.english]?.correctCount || 0) >= CORRECT_THRESHOLD
    );
    if (allLearned && currentModuleData.length > 0) {
      moduleProgress[currentModuleKey] = "learned";
      localStorage.setItem("moduleProgress", JSON.stringify(moduleProgress));
    } else {
      delete moduleProgress[currentModuleKey];
      localStorage.setItem("moduleProgress", JSON.stringify(moduleProgress));
    }
    populateModuleSelection();
  }

  function restartQuiz() {
    resultsContainer.style.display = "none";
    moduleSelectionDiv.style.display = "block";
    currentModuleKey = null;
    currentModuleData = null;
  }

  function updateProgressDisplay() {
    progressList.innerHTML = "";
    const sortedLearned = Object.entries(learnedWords).sort(
      ([, a], [, b]) => b.correctCount - a.correctCount
    );
    sortedLearned.forEach(([word, data]) => {
      const lastPracticedDate = new Date(
        data.lastPracticed
      ).toLocaleDateString();
      progressList.innerHTML += `<li>Aprendido: ${word} (${data.correctCount} veces, Última práctica: ${lastPracticedDate})</li>`;
    });

    const sortedPracticeNeeded = Object.entries(practiceNeeded).sort(
      ([, a], [, b]) => b.incorrectCount - a.incorrectCount
    );
    sortedPracticeNeeded.forEach(([word, data]) => {
      const lastPracticedDate = new Date(
        data.lastPracticed
      ).toLocaleDateString();
      progressList.innerHTML += `<li>Necesita práctica: ${word} (${data.incorrectCount} veces, Última práctica: ${lastPracticedDate})</li>`;
    });
  }

  // Afegim els listeners d'esdeveniments
  nextButton.addEventListener("click", loadQuestion);
  restartButton.addEventListener("click", restartQuiz);

  // Càrrega inicial del qüestionari
  populateModuleSelection();
  updateProgressDisplay();
}
