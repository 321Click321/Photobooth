const loginBtn = document.getElementById('loginBtn');
const passwordInput = document.getElementById('password');
const adminContent = document.getElementById('adminContent');

loginBtn.addEventListener('click', () => {
  if (passwordInput.value === 'boothadmin123') {
    document.getElementById('login').style.display = 'none';
    adminContent.style.display = 'block';
  } else {
    alert('Wrong password');
  }
});
