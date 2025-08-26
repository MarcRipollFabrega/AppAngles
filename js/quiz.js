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
          break; // Prioritza la voz femenina y sale del bucle
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
  try {
    const _supabase = supabaseClient; // Referències als elements del DOM

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
    const sidebar = document.querySelector(".sidebar");

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
      !progressList ||
      !sidebar
    ) {
      console.error(
        "Un o més elements del DOM del qüestionari no es van trobar. Assegura't que el teu HTML té els IDs correctes."
      );
      return;
    }

    sidebar.style.display = "block";

    let currentModuleKey = null;
    let currentModuleData = null;
    let currentQuestionIndex = 0;
    let correctAnswers = 0;
    let currentQuestion;
    let currentUser = null;

    const CORRECT_THRESHOLD = 3;
    const ONE_MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

    async function getCurrentUser() {
      const {
        data: { user },
        error,
      } = await _supabase.auth.getUser();
      if (error || !user) {
        manejarAlerta("No hi ha cap usuari autenticat.", "error");
        return null;
      }
      return user;
    }

    async function updateProgress(userId, wordId, isCorrect) {
      if (!userId || !wordId) {
        console.error(
          "No es pot actualitzar el progrés: l'ID d'usuari o de la paraula no estan definits."
        );
        return;
      }

      const { data: existingProgress, error: fetchError } = await _supabase
        .from("progres_usuari")
        .select("vegades_correctes, vegades_incorrectes, estat")
        .eq("id_usuari", userId)
        .eq("id_paraula", wordId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error al buscar el progrés existent:", fetchError);
        return;
      }

      const currentCorrect = existingProgress
        ? existingProgress.vegades_correctes
        : 0;
      const currentIncorrect = existingProgress
        ? existingProgress.vegades_incorrectes
        : 0;

      let newCorrect = currentCorrect;
      let newIncorrect = currentIncorrect;

      if (isCorrect) {
        if (currentIncorrect > 0) {
          newIncorrect = currentIncorrect - 1;
        } else {
          newCorrect = currentCorrect + 1;
        }
      } else {
        newIncorrect = currentIncorrect + 1;
        if (existingProgress?.estat === "apresa") {
          const { error: updateStateError } = await _supabase
            .from("progres_usuari")
            .update({
              estat: "practicant",
              vegades_correctes: 0,
            })
            .eq("id_usuari", userId)
            .eq("id_paraula", wordId);
          if (updateStateError) {
            console.error("Error al actualitzar l'estat:", updateStateError);
          }
        }
      }

      const newState =
        newCorrect >= CORRECT_THRESHOLD ? "apresa" : "practicant";

      if (newState === "apresa") {
        newIncorrect = 0;
      }

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

    async function fetchLevelsFromSupabase() {
      const { data, error } = await _supabase
        .from("vocabulari")
        .select("nivel_base")
        .order("nivel_base", {
          ascending: true,
        });

      if (error) {
        console.error("Error al obtener los niveles:", error.message);
        return [];
      }

      const uniqueLevels = [...new Set(data.map((item) => item.nivel_base))];
      return uniqueLevels;
    }

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
          .order("tema", {
            ascending: true,
          });

        if (error) {
          console.error(
            `Error al obtener los temas para ${level}:`,
            error.message
          );
          break;
        }

        allTopics.push(...data);

        if (data.length < limit) {
          break;
        }

        offset += limit;
      }

      const uniqueTopics = [...new Set(allTopics.map((item) => item.tema))];
      return uniqueTopics;
    }

    async function obtenerExplicacion(nivel, tema) {
      const { data: explicacion, error } = await _supabase
        .from("explicaciones")
        .select("*")
        .eq("nivel_base", nivel)
        .eq("tema", tema)
        .maybeSingle();

      if (error) {
        console.error("Error en la consulta de explicación:", error);
        return null;
      }

      return explicacion;
    }

    async function fetchVocabularyAndLesson(level, topic) {
      const { data: vocabData, error: vocabError } = await _supabase
        .from("vocabulari")
        .select("*")
        .eq("nivel_base", level)
        .eq("tema", topic)
        .order("id", {
          ascending: true,
        });

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

    async function populateModuleSelection() {
      const availableLevels = await fetchLevelsFromSupabase();
      moduleSelectionDiv.innerHTML = "<h2>Selecciona un nivel:</h2>";

      quizContainer.style.display = "none";
      lessonsContainer.style.display = "none";
      resultsContainer.style.display = "none";
      moduleSelectionDiv.style.display = "block";
      sidebar.style.display = "block";

      availableLevels.forEach((levelName) => {
        const button = document.createElement("button");
        button.textContent = levelName;
        button.addEventListener("click", () => {
          loadModule(levelName);
        });
        moduleSelectionDiv.appendChild(button);
      });
    }

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

    async function prepareModuleData(level) {
      if (!currentUser) {
        manejarAlerta("Inicia sessió per veure el teu progrés.", "error");
        return [];
      }

      const { data: topicsData, error: topicsError } = await _supabase
        .from("vocabulari")
        .select("tema, orden_tema")
        .eq("nivel_base", level)
        .order("orden_tema", {
          ascending: true,
        })
        .limit(1000);

      if (topicsError) {
        console.error("Error al obtener los temas:", topicsError);
        return [];
      }
      const uniqueOrderedTopics = [
        ...new Set(topicsData.map((item) => item.tema)),
      ];

      for (const topic of uniqueOrderedTopics) {
        const { data: vocabData, error: vocabError } = await _supabase
          .from("vocabulari")
          .select(
            "id, english, spanish, example, nivel_base, example_spanish, tema, orden_tema"
          )
          .eq("nivel_base", level)
          .eq("tema", topic);

        if (vocabError) {
          console.error(
            `Error al obtener vocabulario del tema ${topic}:`,
            vocabError
          );
          continue;
        }

        const wordIds = vocabData.map((word) => word.id);

        const { data: progressData, error: progressError } = await _supabase
          .from("progres_usuari")
          .select(
            "id_paraula, vegades_correctes, vegades_incorrectes, estat, data_ultima_practica"
          )
          .eq("id_usuari", currentUser.id)
          .in("id_paraula", wordIds);

        if (progressError && progressError.code !== "PGRST116") {
          console.error(
            `Error al obtener el progreso del tema ${topic}:`,
            progressError
          );
          continue;
        }

        const progressMap = new Map(
          progressData.map((item) => [item.id_paraula, item])
        );

        const wordsNeedingPractice = vocabData
          .map((word) => {
            const progress = progressMap.get(word.id) || {
              vegades_correctes: 0,
              vegades_incorrectes: 0,
              estat: "nova",
              data_ultima_practica: null,
            };
            const direction = progress.estat === "apresa" ? "es-en" : "en-es";
            return {
              ...word,
              progress,
              direction,
            };
          })
          .filter(
            (word) =>
              word.progress.estat !== "apresa" ||
              new Date() - new Date(word.progress.data_ultima_practica) >
                ONE_MONTH_IN_MS
          );

        if (wordsNeedingPractice.length > 0) {
          wordsNeedingPractice.sort((a, b) => {
            if (a.progress.vegades_incorrectes > b.progress.vegades_incorrectes)
              return -1;
            if (a.progress.vegades_incorrectes < b.progress.vegades_incorrectes)
              return 1;
            if (a.progress.estat === "nova" && b.progress.estat !== "nova")
              return -1;
            if (a.progress.estat !== "nova" && b.progress.estat === "nova")
              return 1;
            return 0;
          });
          return wordsNeedingPractice;
        }
      }

      return [];
    }

    async function loadModule(level) {
      currentModuleKey = level;

      sidebar.style.display = "block";

      currentModuleData = await prepareModuleData(level);

      console.log("Datos del módulo cargados:", currentModuleData);

      if (currentModuleData.length === 0) {
        manejarAlerta("No hay palabras para practicar en este nivel.", "info");
        populateModuleSelection();
        return;
      }

      moduleSelectionDiv.style.display = "none";

      lessonsContainer.style.display = "block";
      quizContainer.style.display = "block";

      const explicacion = await obtenerExplicacion(level, "General");
      if (explicacion) {
        cargarLeccion(explicacion.titulo_leccion, explicacion.contenido_html);
      } else {
        cargarLeccion(
          "Sense Explicació",
          "<p>No hi ha una lliçó disponible per a aquest mòdul.</p>"
        );
      }

      currentQuestionIndex = 0;
      correctAnswers = 0;

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
          questionText = `¿Cuál es la traducción de "${currentQuestion.english}"?`;
          exampleText = currentQuestion.example;
          wordToPlay = currentQuestion.english;
          exampleToPlay = currentQuestion.example;
          languageCode = "en-US";
          correctAnswer = currentQuestion.spanish;
          allOptions = currentModuleData.map((item) => item.spanish);
        } else {
          questionText = `¿Cuál es la traducción de "${currentQuestion.spanish}"?`;
          exampleText = currentQuestion.example_spanish;
          wordToPlay = currentQuestion.spanish;
          exampleToPlay = currentQuestion.question_spanish;
          languageCode = "es-ES";
          correctAnswer = currentQuestion.english;
          allOptions = currentModuleData.map((item) => item.english);
        }

        questionElement.textContent = questionText;
        const exampleElement = document.createElement("p");
        exampleElement.textContent = `Ejemplo: ${exampleText}`;
        questionElement.appendChild(document.createElement("br"));
        questionElement.appendChild(exampleElement);

        playWord(wordToPlay, languageCode);
        setTimeout(() => {
          playWord(exampleToPlay, languageCode);
        }, 500);

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

    async function updateProgressDisplay() {
      progressContainer.style.display = "block";
      progressList.innerHTML = "";

      if (!currentUser) {
        progressList.innerHTML =
          "<li>Inicia sessió per veure el teu progrés.</li>";
        return;
      }

      const { data: userProgress, error } = await _supabase
        .from("progres_usuari")
        .select(
          "vegades_correctes, vegades_incorrectes, estat, vocabulari(english, spanish, nivel_base)"
        )
        .eq("id_usuari", currentUser.id)
        .order("data_ultima_practica", {
          ascending: false,
        });

      if (error) {
        console.error("Error al obtener el progreso del usuario:", error);
        progressList.innerHTML = "<li>Error en carregar el progrés.</li>";
        return;
      }

      if (userProgress.length > 0) {
        const lastPracticedLevel = userProgress[0].vocabulari.nivel_base;
        await sendProgressDataToSvg(lastPracticedLevel, userProgress);
      } else {
        progressList.innerHTML =
          "<li>Encara no has practicat cap paraula.</li>";
        await sendProgressDataToSvg("A1", []);
      }

      const learnedWords = userProgress.filter(
        (item) => item.estat === "apresa"
      );
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

    // Nueva función para enviar los datos al SVG estático
    async function sendProgressDataToSvg(level, userProgress) {
      // 1. Calcular los datos de progreso
      const { data: allWords, error: allWordsError } = await _supabase
        .from("vocabulari")
        .select("id")
        .eq("nivel_base", level);

      if (allWordsError) {
        console.error(
          "Error al obtener todas las palabras para el gráfico:",
          allWordsError
        );
        return;
      }

      const totalWords = allWords.length;
      if (totalWords === 0) {
        console.log(
          "No hay palabras en la base de datos para este nivel. No se enviarán datos al SVG."
        );
        return;
      }

      let aprendidas = 0;
      let incorrectas = 0;
      let enProgreso = 0;
      let noPracticadas = totalWords;

      if (userProgress && userProgress.length > 0) {
        noPracticadas = totalWords - userProgress.length;
        userProgress.forEach((item) => {
          if (item.estat === "apresa") {
            aprendidas++;
          } else if (item.vegades_incorrectes > 0) {
            incorrectas++;
          } else {
            enProgreso++;
          }
        });
      }

      const aprendidasPerc = (aprendidas / totalWords) * 100;
      const incorrectasPerc = (incorrectas / totalWords) * 100;
      const enProgresoPerc = (enProgreso / totalWords) * 100;
      const noPracticadasPerc = (noPracticadas / totalWords) * 100;

      // 2. Seleccionar los elementos del SVG estático por su ID
      const svg = document.getElementById("progress-chart-svg");
      const noPracticadasPath = document.getElementById("no-practicadas-path");
      const incorrectasPath = document.getElementById("incorrectas-path");
      const enProgresoPath = document.getElementById("en-progreso-path");
      const aprendidasPath = document.getElementById("aprendidas-path");
      const levelText = document.getElementById("level-text");

      const textContainer = document.getElementById("progress-text");
      if (textContainer) {
        textContainer.innerHTML = `
          <p>Nivel: ${level}</p>
          <p>Aprendidas: ${aprendidas} (${aprendidasPerc.toFixed(1)}%)</p>
          <p>Incorrectas: ${incorrectas} (${incorrectasPerc.toFixed(1)}%)</p>
          <p>En Progreso: ${enProgreso} (${enProgresoPerc.toFixed(1)}%)</p>
          <p>No Practicadas: ${noPracticadas} (${noPracticadasPerc.toFixed(
          1
        )}%)</p>
        `;
      }

      if (!svg || !levelText) {
        console.error(
          "No se encontraron los elementos SVG. Asegúrate de que tu HTML tenga los IDs correctos."
        );
        return;
      }

      levelText.textContent = level;

      // 3. Modificar los atributos de los elementos para reflejar los datos
      let cumulativePercent = 0;

      if (noPracticadasPath) {
        const d = describeArc(
          50,
          50,
          40,
          cumulativePercent * 3.6,
          (cumulativePercent + noPracticadasPerc) * 3.6
        );
        noPracticadasPath.setAttribute("d", d);
        cumulativePercent += noPracticadasPerc;
      }

      if (incorrectasPath) {
        const d = describeArc(
          50,
          50,
          40,
          cumulativePercent * 3.6,
          (cumulativePercent + incorrectasPerc) * 3.6
        );
        incorrectasPath.setAttribute("d", d);
        cumulativePercent += incorrectasPerc;
      }

      if (enProgresoPath) {
        const d = describeArc(
          50,
          50,
          40,
          cumulativePercent * 3.6,
          (cumulativePercent + enProgresoPerc) * 3.6
        );
        enProgresoPath.setAttribute("d", d);
        cumulativePercent += enProgresoPerc;
      }

      if (aprendidasPath) {
        const d = describeArc(
          50,
          50,
          40,
          cumulativePercent * 3.6,
          (cumulativePercent + aprendidasPerc) * 3.6
        );
        aprendidasPath.setAttribute("d", d);
      }
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
      };
    }

    function describeArc(x, y, radius, startAngle, endAngle) {
      if (startAngle === endAngle) return `M ${x} ${y} Z`;
      const start = polarToCartesian(x, y, radius, endAngle);
      const end = polarToCartesian(x, y, radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      const d = [
        "M",
        x,
        y,
        "L",
        start.x,
        start.y,
        "A",
        radius,
        radius,
        0,
        largeArcFlag,
        0,
        end.x,
        end.y,
        "Z",
      ].join(" ");
      return d;
    }

    async function showModuleResults() {
      quizContainer.style.display = "none";
      resultsContainer.style.display = "block";
      resultsList.innerHTML = "";

      const totalQuestions = currentModuleData.length;
      const percentage =
        totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      const listItem = document.createElement("li");
      listItem.textContent = `Resultados del módulo ${currentModuleKey}: Obtuviste ${correctAnswers} de ${totalQuestions} (${percentage.toFixed(
        2
      )}%) respuestas correctas.`;
      resultsList.appendChild(listItem);
    }

    function restartQuiz() {
      resultsContainer.style.display = "none";
      moduleSelectionDiv.style.display = "block";
      currentModuleKey = null;
      currentModuleData = null;
    }

    nextButton.addEventListener("click", loadQuestion);
    restartButton.addEventListener("click", restartQuiz);

    currentUser = await getCurrentUser();
    populateModuleSelection();
    updateProgressDisplay();
  } catch (error) {
    console.error("❌ Se ha producido un error crítico en initQuiz:", error);
    manejarAlerta(
      "Se ha producido un error inesperado. Por favor, revisa la consola para más detalles.",
      "error"
    );
  }
}
