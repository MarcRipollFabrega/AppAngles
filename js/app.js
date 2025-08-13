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
  const loginForm = document.getElementById("login-form");
  const nombreInput = document.getElementById("nombre");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  // Variables de los enlaces para cambiar de formulario
  const toggleLinks = document.querySelectorAll(".toggle-link");

  /************************************************************************** */
  /* FUNCIÓN PARA CAMBIAR ENTRE FORMULARIOS */
  /************************************************************************* */
  function cambiarFormulario() {
    if (window.getComputedStyle(loginForm).display === "none") {
      registroForm.style.display = "none";
      loginForm.style.display = "block";
    } else {
      registroForm.style.display = "block";
      loginForm.style.display = "none";
    }
  }

  /***************************************************************************/
  /* ESCUCHADORES DE EVENTOS */
  /**************************************************************************/
  // Evento para los enlaces que cambian de formulario
  toggleLinks.forEach((enlace) => {
    enlace.addEventListener("click", (e) => {
      e.preventDefault();
      cambiarFormulario();
    });
  });
  /***************************************************************************/
  /* REGISTRO DE USUARIO */
  /**************************************************************************/
  // Evento de envío del formulario de registro
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = nombreInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    if (nombre === "" || email === "" || password === "") {
      alert("El campo no puede estar en blanco");
      return;
    }

    // 1. Validar si el usuario ya existe intentando iniciar sesión.
    const { error: signInError } = await supabaseClient.auth.signInWithPassword(
      {
        email,
        password,
      }
    );

    if (
      signInError &&
      signInError.message.includes("Invalid login credentials")
    ) {
      // Si el error es 'credenciales inválidas', significa que el usuario no existe.
      // Podemos proceder con el registro.

      // 2. Intentar registrar al usuario.
      const { data, error } = await supabaseClient.auth.signUp(
        {
          email: email,
          password: password,
        },
        {
          data: {
            nombre: nombre,
          },
        }
      );

      if (error) {
        // Manejar otros posibles errores de registro (contraseña corta, etc.).
        console.error("Error al registrar usuario:", error.message);
        if (error.message.includes("Password should be at least")) {
          alert("Error: La contraseña debe tener al menos 6 caracteres.");
        } else {
          alert(
            "Ocurrió un error inesperado durante el registro: " + error.message
          );
        }
      } else if (data.user) {
        // Registro exitoso.
        alert(
          "¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta."
        );
      }
    } else if (signInError === null) {
      // Si no hubo error en el inicio de sesión, el usuario ya existe.
      alert("Error: El correo electrónico ya está registrado.");
    } else {
      // Manejar otros posibles errores en la validación inicial.
      alert("Ocurrió un error inesperado al verificar el usuario.");
    }
  });
});
// Nota: Faltaría el código para el formulario de login.
