// Este archivo contiene toda la lógica del cuestionario, separada del archivo principal.

// Importa la función de app.js. Asegúrate de que la ruta sea correcta.
import { controlarVisibilidad } from './app.js'; 

/**
 * Función para reproducir una palabra o frase utilizando Text-to-Speech (Texto a Voz).
 * @param {string} word - La palabra o frase a reproducir.
 * @param {string} languageCode - El código del idioma a utilizar (p. ej., "en-US", "es-ES").
 */
function playWord(word, languageCode) {
  // Verifica si la API de Text-to-Speech es compatible con el navegador.
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = languageCode;

    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    // Bucle para buscar una voz compatible con el idioma especificado.
    for (let i = 0; i < voices.length; i++) {
      if (voices[i].lang.startsWith(languageCode.split("-")[0])) {
        if (voices[i].name.toLowerCase().includes("female")) {
          selectedVoice = voices[i];
          break; // Prioriza la voz femenina y sale del bucle.
        }
        if (!selectedVoice) {
          selectedVoice = voices[i]; // Guarda la primera voz del idioma como voz de respaldo.
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
    // Muestra un error si la API no es compatible.
    console.error(
      "La API de Text-to-Speech no es compatible con este navegador."
    );
  }
}

/**
 * Función principal que inicializa el cuestionario.
 * @param {object} supabaseClient - El cliente de Supabase inicializado.
 * @param {function} manejarAlerta - La función para mostrar alertas.
 */
export async function initQuiz(supabaseClient, manejarAlerta) {
  try {
    const _supabase = supabaseClient;
    // Referencias a los elementos del DOM (Document Object Model).
    const moduleSelectionDiv = document.getElementById("module-selection");
    const lessonsContainer = document.getElementById("lessons-container");
    const quizContainer = document.getElementById("quiz-container");
    const questionElement = document.getElementById("question");
    const optionsContainer = document.getElementById("options");
    const nextButton = document.getElementById("next-button");
    const feedbackElement = document.getElementById("feedback");
    const resultsContainer = document.getElementById("results-container");
    const resultsList = document.getElementById("results-list");
    const exitQuizButton = document.getElementById("exit-quiz-button");
    const progressContainer = document.getElementById("progress-container");
    const progressList = document.getElementById("progress-list");
   
 

    // Oculta el contenedor de lecciones al inicio.
    lessonsContainer.style.display = "none";

    // VERIFICACIÓN: Aseguramos que todos los elementos existen.
    // Condicional para verificar que todos los elementos del DOM necesarios están presentes.
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
      !exitQuizButton ||
      !progressContainer ||
      !progressList 
   
    ) {
      // Muestra un error si falta algún elemento.
      console.error(
        "Uno o más elementos del DOM del cuestionario no se encontraron. Asegúrate de que tu HTML tiene los IDs correctos."
      );
      return;
    }



    // Variables de estado del cuestionario.
    let currentModuleKey = null; // Almacena el nivel o módulo actual.
    let currentModuleData = null; // Almacena los datos del módulo actual.
    let currentQuestionIndex = 0; // Rastrea la pregunta actual.
    let correctAnswers = 0; // Contador de respuestas correctas.
    let currentQuestion; // Almacena el objeto de la pregunta actual.
    let currentUser = null; // Almacena el usuario autenticado.

    // Constantes para el progreso.
    const CORRECT_THRESHOLD = 3; // Umbral de respuestas correctas para marcar una palabra como "apresa".
    const ONE_MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000; // Constante para un mes en milisegundos.

    // Función asíncrona para obtener el usuario autenticado de Supabase.
    async function getCurrentUser() {
      const {
        data: { user },
        error,
      } = await _supabase.auth.getUser();
      // Condicional para manejar errores o la ausencia de usuario.
      if (error || !user) {
        manejarAlerta("No hay ningún usuario autenticado.", "error");
        return null;
      }
      return user;
    }

    // Función asíncrona para actualizar el progreso de una palabra en la base de datos.
    async function updateProgress(userId, wordId, isCorrect) {
      // Condicional para verificar si los IDs de usuario y palabra están definidos.
      if (!userId || !wordId) {
        console.error(
          "No se puede actualizar el progreso: el ID de usuario o de la palabra no están definidos."
        );
        return;
      }

      // Busca el progreso existente para la palabra y el usuario.
      const { data: existingProgress, error: fetchError } = await _supabase
        .from("progres_usuari")
        .select("vegades_correctes, vegades_incorrectes, estat")
        .eq("id_usuari", userId)
        .eq("id_paraula", wordId)
        .single();

      // Condicional para manejar errores en la búsqueda del progreso.
      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error al buscar el progreso existente:", fetchError);
        return;
      }

      // Inicializa las variables de progreso con los valores existentes o con 0.
      const currentCorrect = existingProgress
        ? existingProgress.vegades_correctes
        : 0;
      const currentIncorrect = existingProgress
        ? existingProgress.vegades_incorrectes
        : 0;

      let newCorrect = currentCorrect;
      let newIncorrect = currentIncorrect;

      // Lógica para actualizar los contadores de respuestas correctas e incorrectas.
      if (isCorrect) {
        if (currentIncorrect > 0) {
          newIncorrect = currentIncorrect - 1;
        } else {
          newCorrect = currentCorrect + 1;
        }
      } else {
        newIncorrect = currentIncorrect + 1;
        // Si la palabra estaba aprendida y se responde incorrectamente, cambia su estado.
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
            console.error("Error al actualizar el estado:", updateStateError);
          }
        }
      }

      // Determina el nuevo estado de la palabra ("apresa" o "practicant").
      const newState =
        newCorrect >= CORRECT_THRESHOLD ? "apresa" : "practicant";

      if (newState === "apresa") {
        newIncorrect = 0; // Resetea las incorrectas si la palabra se ha aprendido.
      }

      const dataToUpdate = {
        vegades_correctes: newCorrect,
        vegades_incorrectes: newIncorrect,
        estat: newState,
        data_ultima_practica: new Date().toISOString(),
      };

      // Condicional para decidir si actualizar o insertar un nuevo registro de progreso.
      if (existingProgress) {
        const { error: updateError } = await _supabase
          .from("progres_usuari")
          .update(dataToUpdate)
          .eq("id_usuari", userId)
          .eq("id_paraula", wordId);

        if (updateError) {
          console.error("Error al actualizar el progreso:", updateError);
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
          console.error("Error al insertar el progreso:", insertError);
        }
      }
    }

    // Función asíncrona para obtener los niveles de la base de datos.
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

      // Utiliza un Set para obtener solo los niveles únicos.
      const uniqueLevels = [...new Set(data.map((item) => item.nivel_base))];
      return uniqueLevels;
    }

    // Función asíncrona para obtener los temas de un nivel específico.
    async function fetchTopicsFromSupabase(level) {
      let allTopics = [];
      let offset = 0;
      const limit = 1000;

      // Bucle para obtener temas en lotes si hay muchos resultados.
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

        // Sale del bucle si no hay más datos.
        if (data.length < limit) {
          break;
        }

        offset += limit;
      }

      const uniqueTopics = [...new Set(allTopics.map((item) => item.tema))];
      return uniqueTopics;
    }

    // Función asíncrona para obtener la explicación de un tema.
    async function obtenerExplicacion(nivel, tema) {
      const { data: explicacion, error } = await _supabase
        .from("explicaciones")
        .select("*")
        .eq("nivel_base", nivel)
        .eq("tema", tema)
        .maybeSingle(); // Obtiene un solo registro o null.

      if (error) {
        console.error("Error en la consulta de explicación:", error);
        return null;
      }

      return explicacion;
    }

    // Función asíncrona para obtener el vocabulario y la lección de un tema.
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

    // Función asíncrona para llenar la selección de módulos con botones de nivel.
    async function populateModuleSelection() {
      const availableLevels = await fetchLevelsFromSupabase();
      moduleSelectionDiv.innerHTML = "<h2>Selecciona un nivel:</h2>";

      // Oculta otros contenedores y muestra el de selección de módulos.
      quizContainer.style.display = "none";
      lessonsContainer.style.display = "none";
      resultsContainer.style.display = "none";
      moduleSelectionDiv.style.display = "block";
  

      // Crea y añade un botón para cada nivel disponible.
      availableLevels.forEach((levelName) => {
        const button = document.createElement("button");
        button.textContent = levelName;
        button.addEventListener("click", () => {
          loadModule(levelName);
        });
        moduleSelectionDiv.appendChild(button);
      });
    }

    // Función asíncrona para cargar y mostrar el contenido de una lección.
    async function cargarLeccion(title, content) {
      const lessonsListContainer = document.getElementById("lessons-list");
      lessonsListContainer.innerHTML = "";

      // Condicional para verificar si el contenido existe.
      if (title && content) {
        const titleElement = document.createElement("h3");
        titleElement.textContent = title;
        lessonsListContainer.appendChild(titleElement);

        // NUEVO: Renderiza el contenido de Markdown a HTML
        lessonsListContainer.innerHTML += marked.parse(content);
      } else {
        lessonsListContainer.innerHTML = `<p>No se ha encontrado contenido para esta lección.</p>`;
      }
    }

    // Función asíncrona para preparar los datos del módulo, incluyendo el progreso del usuario.
    async function prepareModuleData(level) {
      // Condicional para asegurarse de que el usuario está autenticado.
      if (!currentUser) {
        manejarAlerta("Inicia sesión para ver tu progreso.", "error");
        return [];
      }

      // Obtiene todos los temas para el nivel.
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

      // Bucle para iterar sobre cada tema.
      for (const topic of uniqueOrderedTopics) {
        // Obtiene el vocabulario para el tema actual.
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

        // Obtiene el progreso del usuario para las palabras de este tema.
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

        // Filtra las palabras que necesitan práctica.
        const wordsNeedingPractice = vocabData
          .map((word) => {
            const progress = progressMap.get(word.id) || {
              vegades_correctes: 0,
              vegades_incorrectes: 0,
              estat: "nova",
              data_ultima_practica: null,
            };
            // Define la dirección de la traducción según el estado de la palabra.
            const direction = progress.estat === "apresa" ? "es-en" : "en-es";
            return {
              ...word,
              progress,
              direction,
            };
          })
          .filter(
            // Condicional para incluir solo palabras que necesitan ser practicadas.
            (word) =>
              word.progress.estat !== "apresa" ||
              new Date() - new Date(word.progress.data_ultima_practica) >
                ONE_MONTH_IN_MS
          );

        // Si hay palabras que practicar, las ordena y devuelve.
        if (wordsNeedingPractice.length > 0) {
          wordsNeedingPractice.sort((a, b) => {
            // Lógica de ordenación para priorizar palabras con más errores o nuevas.
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

    // Función asíncrona para cargar un módulo de cuestionario.
    async function loadModule(level) {
      currentModuleKey = level;

     

      currentModuleData = await prepareModuleData(level);

      

      // Condicional para manejar el caso de que no haya palabras para practicar.
      if (currentModuleData.length === 0) {
        manejarAlerta("No hay palabras para practicar en este nivel.", "info");
        populateModuleSelection();
        return;
      }

      // Muestra los contenedores del cuestionario y lecciones.
      moduleSelectionDiv.style.display = "none";
      lessonsContainer.style.display = "block";
      quizContainer.style.display = "block";
      //Carga la función para controlar visualización de los elementos
      controlarVisibilidad();

      // Reinicia los contadores para el nuevo cuestionario.
      currentQuestionIndex = 0;
      correctAnswers = 0;

      loadQuestion();
    }

    // Función para cargar la siguiente pregunta del cuestionario.
    async function loadQuestion() {
      // Condicional para verificar si hay más preguntas.
      if (currentQuestionIndex < currentModuleData.length) {
        currentQuestion = currentModuleData[currentQuestionIndex];
        optionsContainer.innerHTML = "";
        feedbackElement.textContent = "";

        // NUEVO: Llama a la función 'obtenerExplicacion' con el tema de la pregunta actual
        const explicacion = await obtenerExplicacion(
          currentQuestion.nivel_base,
          currentQuestion.tema
        );

        if (explicacion) {
          cargarLeccion(explicacion.titulo_leccion, explicacion.contenido_html);
        } else {
          cargarLeccion(
            "Sin Explicación",
            "<p>No hay una lección disponible para este tema.</p>"
          );
        }

        let questionText,
          exampleText,
          wordToPlay,
          exampleToPlay,
          languageCode,
          correctAnswer,
          allOptions;

        // Condicional para configurar la pregunta y las opciones según la dirección de traducción.
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
          exampleToPlay = currentQuestion.example_spanish;
          languageCode = "es-ES";
          correctAnswer = currentQuestion.english;
          allOptions = currentModuleData.map((item) => item.english);
        }

        questionElement.textContent = questionText;
        const exampleElement = document.createElement("p");
        exampleElement.textContent = `Ejemplo: ${exampleText}`;
        questionElement.appendChild(document.createElement("br"));
        questionElement.appendChild(exampleElement);

        // Reproduce el audio de la palabra y la frase de ejemplo.
        playWord(wordToPlay, languageCode);
        setTimeout(() => {
          playWord(exampleToPlay, languageCode);
        }, 500);

        // Genera 4 opciones de respuesta, incluyendo la correcta.
        const randomOptions = new Set();
        randomOptions.add(correctAnswer);
        while (randomOptions.size < 4) {
          const randomIndex = Math.floor(Math.random() * allOptions.length);
          const randomWord = allOptions[randomIndex];
          randomOptions.add(randomWord);
        }
        // Convierte el Set en un array y lo mezcla.
        const optionsArray = Array.from(randomOptions).sort(
          () => Math.random() - 0.5
        );

        // Crea un botón para cada opción.
        optionsArray.forEach((option) => {
          const button = document.createElement("button");
          button.textContent = option;
          button.addEventListener("click", () =>
            checkAnswer(option, correctAnswer)
          );
          optionsContainer.appendChild(button);
        });
      } else {
        showModuleResults(); // Llama a la función para mostrar los resultados al finalizar.
      }
    }

    // Función asíncrona para verificar la respuesta del usuario.
    async function checkAnswer(selectedAnswer, correctAnswer) {
      const buttons = optionsContainer.querySelectorAll("button");
      // Deshabilita los botones y resalta la respuesta correcta.
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

      // Condicional para actualizar el progreso solo si hay un usuario autenticado.
      if (currentUser) {
        if (isCorrect) {
          await updateProgress(currentUser.id, currentQuestion.id, true);
        } else {
          await updateProgress(currentUser.id, currentQuestion.id, false);
        }

        await updateProgressDisplay();
      }

      currentQuestionIndex++; // Pasa a la siguiente pregunta.
      // Condicional para cargar la siguiente pregunta o mostrar los resultados.
      if (currentQuestionIndex < currentModuleData.length) {
        setTimeout(loadQuestion, 1500);
      } else {
        setTimeout(showModuleResults, 1500);
      }
    }

    // Función asíncrona para actualizar la visualización del progreso del usuario.
    async function updateProgressDisplay() {
      progressContainer.style.display = "block";
      progressList.innerHTML = "";

      // Condicional para el caso de que no haya usuario.
      if (!currentUser) {
        progressList.innerHTML = "<li>Inicia sesión para ver tu progreso.</li>";
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
        progressList.innerHTML = "<li>Error al cargar el progreso.</li>";
        return;
      }

      // Condicional para enviar datos al gráfico SVG si hay progreso.
      if (userProgress.length > 0) {
        const lastPracticedLevel = userProgress[0].vocabulari.nivel_base;
        await sendProgressDataToSvg(lastPracticedLevel, userProgress);
      } else {
        progressList.innerHTML =
          "<li>Todavía no has practicado ninguna palabra.</li>";
        await sendProgressDataToSvg("A1", []);
      }

      // Filtra y muestra las palabras aprendidas y las que necesitan práctica.
      const learnedWords = userProgress.filter(
        (item) => item.estat === "apresa"
      );
      if (learnedWords.length > 0) {
        progressList.innerHTML += "<h3>Palabras aprendidas:</h3>";
        learnedWords.forEach((item) => {
          progressList.innerHTML += `
            <li>
                <strong>${item.vocabulari.english}</strong> (${item.vocabulari.spanish})
                <br> Correctas: ${item.vegades_correctes} | Incorrectas: ${item.vegades_incorrectes}
            </li>
          `;
        });
      }

      const needsPracticeWords = userProgress.filter(
        (item) => item.estat !== "apresa"
      );
      if (needsPracticeWords.length > 0) {
        progressList.innerHTML += "<h3>Palabras que necesitan práctica:</h3>";
        needsPracticeWords.forEach((item) => {
          progressList.innerHTML += `
            <li>
                <strong>${item.vocabulari.english}</strong> (${item.vocabulari.spanish})
                <br> Correctas: ${item.vegades_correctes} | Incorrectas: ${item.vegades_incorrectes}
            </li>
          `;
        });
      }
    }

    // Nueva función para enviar los datos al SVG estático
    async function sendProgressDataToSvg(level, userProgress) {
      // 1. Calcular los datos de progreso
      // Obtiene el total de palabras para el nivel.
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

      // Calcula las estadísticas de progreso.
      let aprendidas = 0;
      let incorrectas = 0;
      let enProgreso = 0;
      let noPracticadas = totalWords;

      if (userProgress && userProgress.length > 0) {
        noPracticadas = totalWords - userProgress.length;
        // Bucle para contar las palabras según su estado.
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

      // Calcula los porcentajes de cada categoría.
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
      // Condicional para actualizar el texto de progreso.
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

      // Condicional para verificar los elementos SVG.
      if (!svg || !levelText) {
        console.error(
          "No se encontraron los elementos SVG. Asegúrate de que tu HTML tenga los IDs correctos."
        );
        return;
      }

      levelText.textContent = level;

      // 3. Modificar los atributos de los elementos para reflejar los datos
      let cumulativePercent = 0;

      // Actualiza los arcos del gráfico circular (pie chart) con los porcentajes calculados.
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

    // Función de ayuda para convertir coordenadas polares a cartesianas.
    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
      };
    }

    // Función de ayuda para generar la ruta (path) de un arco SVG.
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

    // Función asíncrona para mostrar los resultados finales del módulo.
    async function showModuleResults() {
      // Oculta el cuestionario y muestra los resultados.
      quizContainer.style.display = "none";
      resultsContainer.style.display = "block";
      resultsList.innerHTML = "";

      const totalQuestions = currentModuleData.length;
      // Calcula el porcentaje de respuestas correctas.
      const percentage =
        totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      const listItem = document.createElement("li");
      listItem.textContent = `Resultados del módulo ${currentModuleKey}: Obtuviste ${correctAnswers} de ${totalQuestions} (${percentage.toFixed(
        2
      )}%) respuestas correctas.`;
      resultsList.appendChild(listItem);
    }

    // Función para reiniciar el cuestionario y volver a la selección de módulos.
    function restartQuiz() {
      resultsContainer.style.display = "none";
      lessonsContainer.style.display = "none";
      moduleSelectionDiv.style.display = "block";
      // Restablece las variables de estado.
      currentModuleKey = null;
      currentModuleData = null;
    }

    // Asigna los event listeners a los botones.
    nextButton.addEventListener("click", loadQuestion);
    exitQuizButton.addEventListener("click", restartQuiz);

    // Inicializa la aplicación.
    currentUser = await getCurrentUser();
    populateModuleSelection();
    updateProgressDisplay();
  } catch (error) {
    // Captura y maneja cualquier error inesperado durante la inicialización.
    console.error("Error al inicializar el cuestionario:", error);
    manejarAlerta("Hubo un error al cargar el cuestionario.", "error");
  }
}
