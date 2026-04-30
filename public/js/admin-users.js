// admin-users.js - fetch and manage users (admin-only)
(function(){
  const token = localStorage.getItem('myToken');
  if (!token) { alert('Bạn cần đăng nhập.'); window.location.href = '/login.html'; }

  const t = { headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };

  const usersTableBody = document.getElementById('usersTableBody');
  const searchInput = document.getElementById('searchInput');

  let users = [];

  async function loadUsers(){
    usersTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-gray-500">Đang tải...</td></tr>';
    try{
      const res = await fetch('/api/test/users', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) throw new Error('Không lấy được danh sách');
      users = await res.json();
      renderUsers(users);
    }catch(e){
      usersTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-red-500">Lỗi: ${e.message}</td></tr>`;
    }
  }

  function renderUsers(list){
    if (!list || list.length === 0) {
      usersTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-gray-500">Không có người dùng.</td></tr>';
      return;
    }
    usersTableBody.innerHTML = '';
    for (const u of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-2">${escapeHtml(u.username || '')}</td>
        <td class="px-4 py-2">${escapeHtml(u.fullName || '')}</td>
        <td class="px-4 py-2">${escapeHtml(u.email || '')}</td>
        <td class="px-4 py-2">${escapeHtml(u.role || '')}</td>
        <td class="px-4 py-2"><button data-id="${u._id}" class="editBtn px-3 py-1 bg-gray-100 rounded">Chỉnh sửa</button></td>
      `;
      usersTableBody.appendChild(tr);
    }
    document.querySelectorAll('.editBtn').forEach(b => b.addEventListener('click', onEditClick));
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function onEditClick(e){
    const id = e.currentTarget.getAttribute('data-id');
    openEditModal(id);
  }

  async function openEditModal(id){
    const modal = document.getElementById('editModal');
    try{
      const res = await fetch('/api/test/users/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) throw new Error('Không tải được người dùng');
      const u = await res.json();//adasds
      document.getElementById('editId').value = u._id || '';
      document.getElementById('editUsername').value = u.username || '';
      document.getElementById('editRole').value = u.role || 'hoc_tro';
      document.getElementById('editFullName').value = u.fullName || '';
      document.getElementById('editDob').value = u.dob ? new Date(u.dob).toISOString().slice(0,10) : '';
      document.getElementById('editPhone').value = u.phone || '';
      document.getElementById('editEmail').value = u.email || '';
      document.getElementById('editSchool').value = u.school || '';
      document.getElementById('editGrade').value = u.grade || '9';
      document.getElementById('editNewPassword').value = '';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }catch(err){ alert('Lỗi: ' + err.message); }
  }

  function closeModal(){
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  document.getElementById('cancelBtn').addEventListener('click', (e)=>{ e.preventDefault(); closeModal(); });

  document.getElementById('editForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const payload = {
      role: document.getElementById('editRole').value,
      fullName: document.getElementById('editFullName').value,
      dob: document.getElementById('editDob').value,
      phone: document.getElementById('editPhone').value,
      email: document.getElementById('editEmail').value,
      school: document.getElementById('editSchool').value,
      grade: document.getElementById('editGrade').value
    };
    const newPassword = document.getElementById('editNewPassword').value;
    if (newPassword && newPassword.length > 0) payload.newPassword = newPassword;

    try{
      const res = await fetch('/api/test/users/' + id, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const txt = await res.text(); throw new Error(txt || 'Lỗi server');
      }
      const updated = await res.json();
      alert('Cập nhật thành công');
      closeModal();
      await loadUsers();
    }catch(err){ alert('Lỗi: ' + err.message); }
  });

  searchInput.addEventListener('input', ()=>{
    const q = (searchInput.value||'').toLowerCase().trim();
    if (!q) return renderUsers(users);
    const filtered = users.filter(u => (u.username||'').toLowerCase().includes(q) || (u.fullName||'').toLowerCase().includes(q));
    renderUsers(filtered);
  });

  // init
  loadUsers();

})();
