const fs = require('fs');
const path = require('path');
const dir = 'public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace all occurences
    content = content.replace(/Ð\uFFFD\u001ANG XU?T/g, 'ÐANG XU?T');
    content = content.replace(/Ð\uFFFD NG XU?T/g, 'ÐANG XU?T');
    content = content.replace(/N\uFFFDi dung bài h?c/g, 'N?i dung bài h?c');
    content = content.replace(/Ðang t?i d? li\uFFFD!u\.\.\./g, 'Ðang t?i d? li?u...');
    content = content.replace(/T?i tài li\uFFFD!u lên/g, 'T?i tài li?u lên');
    content = content.replace(/m\uFFFDi dung bên trái \uFFFD ? xem/g, 'm?t n?i dung bên trái d? xem');
    content = content.replace(/m\uFFFDi dung bên trái \uFFFD ? xem/g, 'm?t n?i dung bên trái d? xem');
    content = content.replace(/m\uFFFDt n\uFFFDi dung bên trái \uFFFD ? xem/g, 'm?t n?i dung bên trái d? xem');
    content = content.replace(/\uFFFDx \uFFFD/g, '??');
    content = content.replace(/\uFFFDx a/g, '??');
    content = content.replace(/\uFFFDx\} /g, '??');
    content = content.replace(/\uFFFDx\uFFFD ?\uFFFDx\} /g, '??');
    content = content.replace(/L\uFFFD9ch s? h?c/g, 'L?ch s? h?c');
    content = content.replace(/tính g?n \uFFFD úng/g, 'tính g?n dúng');
    content = content.replace(/Ð?i S\uFFFD  Tuy?n Tính/g, 'Ð?i S? Tuy?n Tính');
    content = content.replace(/phân ph\uFFFD i xác su?t/g, 'phân ph?i xác su?t');
    content = content.replace(/Th\uFFFD ng Kê/g, 'Th?ng Kê');
    content = content.replace(/Thêm chuong m\uFFFD:i/g, 'Thêm chuong m?i');
    content = content.replace(/T?o m\uFFFD:i/g, 'T?o m?i');
    content = content.replace(/tài li\uFFFDu/g, 'tài li?u');
    content = content.replace(/Xóa tài li\uFFFD!u/g, 'Xóa tài li?u');
    
    // Fallbacks just in case
    content = content.replace(/Ð.*NG XU?T/g, 'ÐANG XU?T');

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Fixed text in', file);
}
