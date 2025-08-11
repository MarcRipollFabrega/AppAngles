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
    //Comprueba si el usuario a dejado algun campo en blanco
    if (nombre == "" || email == "" || password == "") {
      alert("El campo no puede estar en blanco");
      return;
    }

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
    //Manejo de errores en el registro de usuario

    if (error || data.user === null) {
      if (error.message.includes("Email address")) {
        console.error(
          "Error: el correo electrónico es inválido o ya está en uso."
        );
        alert("El correo electrónico no es válido o ya está en uso.");
      } else if (error.message.includes("Password should be at least")) {
        console.error("Error: la contraseña es demasiado corta.");
        alert("La contraseña debe tener al menos 6 caracteres.");
      } else {
        // Este else actúa como nuestro 'default'
        console.error("Error al registrar usuario:", error.message);
        alert("Ocurrió un error inesperado: " + error.message);
      }
    } else {
      console.log("Usuario registrado con éxito:", data.user);
      alert(
        "¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta."
      );
    }
  });

  // Nota: Faltaría el código para el formulario de login.
});
