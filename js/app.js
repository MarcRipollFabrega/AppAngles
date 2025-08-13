/***************************************************************************/
/* CONNEXIÓN SUPABASE */
/**************************************************************************/
// La conexión a Supabase se define una sola vez al principio.
const supabaseUrl = "https://udvyzslgbaxpicfjklvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnl6c2xnYmF4cGljZmprbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTY5NTIsImV4cCI6MjA3MDIzMjk1Mn0.VjqrlFp_MfilwuTw4OSAdK3aEIwfXB2bdq6GLoJREoo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener("DOMContentLoaded", () => {
  /***************************************************************************/
  /* VARIABLES DE LOS FORMULARIOS */
  /**************************************************************************/
  const registroForm = document.getElementById("registro-form");
  const loginForm = document.getElementById("login-form"); // Variables para el formulario de REGISTRO
  const nombreInput = document.getElementById("nombre");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password"); // Variables para el formulario de LOGIN

  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password"); // Variables de los enlaces para cambiar de formulario

  const toggleLinks = document.querySelectorAll(".toggle-link"); // Variable de la alerta
  const alertDiv = document.getElementById("alerta"); // Variable del botón de cerrar sesión
  const logoutButton = document.getElementById("logout-button"); // Captura el contenedor de bienvenida y los formularios

  const bienvenidaContainer = document.getElementById(
    "bienvenida-container"
  ); /************************************************************************** */ /* FUNCIÓN PARA CAMBIAR ENTRE FORMULARIOS */ /************************************************************************* */

  function cambiarFormulario() {
    if (window.getComputedStyle(loginForm).display === "none") {
      registroForm.style.display = "none";
      loginForm.style.display = "block";
    } else {
      registroForm.style.display = "block";
      loginForm.style.display = "none";
    }
  } // Nueva función para mostrar los formularios y ocultar la bienvenida

  function mostrarFormularios() {
    bienvenidaContainer.style.display = "none";
    logoutButton.style.display = "none";
    registroForm.style.display = "block";
    loginForm.style.display = "none";
  } /***************************************************************************/ /* ESCUCHADORES DE EVENTOS */ /**************************************************************************/ // Evento para los enlaces que cambian de formulario
  toggleLinks.forEach((enlace) => {
    enlace.addEventListener("click", (e) => {
      e.preventDefault();
      cambiarFormulario();
    });
  }); // Evento para cerrar sesión
  logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error("Error al cerrar sesión:", error);
      manejarAlerta("Error al cerrar sesión.", "error");
    } else {
      manejarAlerta("Sesión cerrada correctamente.", "exito");
      mostrarFormularios();
    }
  }); /***************************************************************************/ /* REGISTRO DE USUARIO (SOLO Llama a signUp) */ /**************************************************************************/ // Evento de envío del formulario de registro

registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = nombreInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    if (nombre === "" || email === "" || password === "") {
        alert("El campo no puede estar en blanco");
        return;
    }

    // Paso 1: Intentamos registrar al usuario sin metadatos
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (signUpError) {
        console.error("Error al registrar usuario:", signUpError.message);
        if (signUpError.message.includes("Password should be at least")) {
            manejarAlerta("Error: La contraseña debe tener al menos 6 caracteres.", "error");
        } else if (signUpError.message.includes("User already registered")) {
            manejarAlerta("Error: El correo electrónico ya está registrado.", "error");
        } else {
            manejarAlerta("Ocurrió un error inesperado durante el registro: " + signUpError.message, "error");
        }
    } else if (signUpData.user) {
        console.log("Usuario registrado con éxito:", signUpData.user);
        
        // Paso 2: Si el registro fue exitoso, actualizamos los metadatos con el nombre
        const { data: updateData, error: updateError } = await supabaseClient.auth.updateUser({
            data: {
                nombre: nombre,
            },
        });

        if (updateError) {
            console.error("Error al actualizar metadatos del usuario:", updateError);
            // Si falla la actualización, mostramos la bienvenida sin el nombre
            manejarAlerta("¡Registro exitoso! Pero no se pudo guardar tu nombre. Por favor, revisa tu correo.", "exito");
            mostrarBienvenida("usuario");
        } else {
            console.log("Metadatos de usuario actualizados correctamente:", updateData);
            manejarAlerta("¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta.", "exito");
            mostrarBienvenida(nombre);
        }
    }
});
  /************************************************************************** */ /* FORMULARIO DE LOGIN (SOLO Llama a signIn) */ /************************************************************************* */

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (email === "" || password === "") {
      manejarAlerta(
        "El email o la contraseña no pueden estar en blanco.",
        "error"
      );
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Error al iniciar sesión:", error.message);
      manejarAlerta(
        "Credenciales inválidas. Por favor, revisa tu email y contraseña.",
        "error"
      );
    } else if (data.user) {
      console.log("Inicio de sesión exitoso:", data.user);
      manejarAlerta("¡Bienvenido de nuevo!", "exito");
      const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

      if (userError) {
        console.error("Error al obtener datos del usuario:", userError);
        mostrarBienvenida("usuario");
      } else {
        const nombreUsuario = userData.user.user_metadata.nombre;
        mostrarBienvenida(nombreUsuario);
      }
    }
  }); /************************************************************************** */ /* ALERTAS DINAMICAS */ /************************************************************************* */

  function manejarAlerta(mensaje, tipo) {
    alertDiv.className = "alerta mostrar " + tipo;
    alertDiv.innerHTML = mensaje;
    setTimeout(() => {
      alertDiv.className = "alerta";
    }, 3000);
  }
  function mostrarBienvenida(nombre) {
    registroForm.style.display = "none";
    loginForm.style.display = "none";
    bienvenidaContainer.style.display = "block";
    logoutButton.style.display = "block";
    document.getElementById("nombre-usuario").textContent = nombre;
  }
});
