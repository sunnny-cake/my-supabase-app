document.getElementById('feedbackForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(this);

    try {
        const response = await fetch('http://localhost:3000/api/feedback', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (result.success) {
            document.getElementById('message').innerText = '上传成功！';
        } else {
            document.getElementById('message').innerText = '上传失败：' + result.error;
        }
    } catch (err) {
        console.error(err);
        document.getElementById('message').innerText = '上传发生错误';
    }
});
