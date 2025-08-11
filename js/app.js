/***************************************************************************/
/*CONNEXIÓN SUPABASE */
/**************************************************************************/

const supabaseUrl = "https://udvyzslgbaxpicfjklvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnl6c2xnYmF4cGljZmprbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTY5NTIsImV4cCI6MjA3MDIzMjk1Mn0.VjqrlFp_MfilwuTw4OSAdK3aEIwfXB2bdq6GLoJREoo";

const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
/************************************************************************** */
/* CAMBIAR ENTRE FORMULARIOS */
/************************************************************************* */
function cambiarFormulario() {
  let formulario_Registro = document.getElementById("registro-form");
  let formulario_Login = document.getElementById("login-form");
  if (window.getComputedStyle(formulario_Login).display === "none") {
    formulario_Registro.style.display = "none";
    formulario_Login.style.display = "block";
  } else {
    formulario_Registro.style.display = "block";
    formulario_Login.style.display = "none";
  }
}

/***************************************************************************/
/*FORMULARIO DE REGISTRO */
/**************************************************************************/
// variables del formulario
const registroForm = document.getElementById('registro-form');
const nombreInput = document.getElementById("nombre");
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// Escuchamos el evento de envío del formulario
registroForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitamos que la página se recargue

    // Obtenemos los valores de los campos
    const nombre = nombreInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    // Usamos Supabase para registrar al usuario
    const { data, error } = await supabase.auth.signUp({
      nombre: nombre,  
      email: email,
        password: password,
    });

    if (error) {
        console.error('Error al registrar usuario:', error.message);
        alert('Error al registrar usuario: ' + error.message);
    } else {
        console.log('Usuario registrado con éxito:', data.user);
        alert('¡Registro exitoso! Por favor, revisa tu correo para confirmar la cuenta.');
    }
});