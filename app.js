const ENGINE_URL = 'https://izrdxpbpmicatdtelkzo.supabase.co/functions/v1/undercover-engine';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmR4cGJwbWljYXRkdGVsa3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzcyMTIsImV4cCI6MjEwMTI1MzIxMn0.6U_jsCLJRl3wGXQqoL7-A5SfMaKATXDHFnHA3zsjHyE';

// =========================================================================
// BIẾN TOÀN CỤC
// =========================================================================
let currentRoomCode = null;
let currentPlayerId = null;
let currentName = null;
let isGM = false;
let pollingInterval = null;
let currentGameState = null;
let notifiedEliminated = new Set();
let isShowingWinner = false;

// =========================================================================
// UI ELEMENTS
// =========================================================================
const screenLobby = document.getElementById('screen-lobby');
const screenWaiting = document.getElementById('screen-waiting');
const screenPlaying = document.getElementById('screen-playing');

// Lobby
const btnShowJoin = document.getElementById('btn-show-join');
const joinForm = document.getElementById('join-form');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');

// Waiting
const displayRoomCode = document.getElementById('display-room-code');
const gmSettings = document.getElementById('gm-settings');
const btnStartGame = document.getElementById('btn-start-game');
const waitingPlayerList = document.getElementById('waiting-player-list');

// Playing
const keywordCard = document.getElementById('keyword-card');
const displayKeyword = document.getElementById('display-keyword');
const playingPlayerList = document.getElementById('playing-player-list');
const btnGmMenu = document.getElementById('btn-gm-menu');
const gmMenuContent = document.getElementById('gm-menu-content');
const btnCancelRoom = document.getElementById('btn-cancel-room');
const btnResetRoom = document.getElementById('btn-reset-room');
const displayPlayingRoomCode = document.getElementById('display-playing-room-code');
const displayPlayingName = document.getElementById('display-playing-name');
const btnLeaveRoomWaiting = document.getElementById('btn-leave-room-waiting');
const btnLeaveRoomPlaying = document.getElementById('btn-leave-room-playing');

// =========================================================================
// HELPER: GỌI EDGE FUNCTION
// =========================================================================
async function callEngine(action, payload = {}) {
    try {
        const response = await fetch(ENGINE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                action: action,
                roomCode: currentRoomCode,
                requesterId: currentPlayerId,
                payload: payload
            })
        });
        const data = await response.json();
        return data;
    } catch (err) {
        console.error(err);
        return { status: 'error', message: 'Không thể kết nối đến máy chủ!' };
    }
}

// =========================================================================
// ĐIỀU HƯỚNG MÀN HÌNH
// =========================================================================
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// =========================================================================
// SỰ KIỆN LOBBY
// =========================================================================
btnShowJoin.addEventListener('click', () => {
    joinForm.style.display = 'flex';
});

btnCreateRoom.addEventListener('click', async () => {
    Swal.showLoading();
    const res = await callEngine('create_room');
    Swal.close();
    
    if (res.status === 'success') {
        currentRoomCode = res.roomCode;
        joinForm.style.display = 'flex';
        document.getElementById('input-room-code').value = currentRoomCode;
        Swal.fire({
            icon: 'success',
            title: 'Tạo phòng thành công!',
            text: `Mã phòng của bạn là: ${currentRoomCode}`,
            confirmButtonColor: '#66fcf1'
        });
    } else {
        Swal.fire('Lỗi', res.message, 'error');
    }
});

btnJoinRoom.addEventListener('click', async () => {
    const code = document.getElementById('input-room-code').value.trim();
    const name = document.getElementById('input-player-name').value.trim();
    
    if (!code || !name) {
        Swal.fire('Lỗi', 'Vui lòng nhập mã phòng và tên!', 'warning');
        return;
    }

    Swal.showLoading();
    currentRoomCode = code;
    const res = await callEngine('join_room', { playerName: name });
    Swal.close();

    if (res.status === 'success') {
        currentPlayerId = res.playerId;
        currentName = name;
        isGM = res.isGM;
        
        // Lưu vào sessionStorage để chống văng khi load lại/chuyển tab
        sessionStorage.setItem('uc_roomCode', currentRoomCode);
        sessionStorage.setItem('uc_playerId', currentPlayerId);
        sessionStorage.setItem('uc_playerName', currentName);
        sessionStorage.setItem('uc_isGM', isGM);

        displayRoomCode.innerText = currentRoomCode;
        displayPlayingRoomCode.innerText = currentRoomCode;
        displayPlayingName.innerText = currentName;
        if (isGM) gmSettings.style.display = 'flex';
        
        switchScreen('screen-waiting');
        startPolling();
    } else {
        Swal.fire('Lỗi', res.message, 'error');
    }
});

// =========================================================================
// SỰ KIỆN WAITING ROOM
// =========================================================================
btnStartGame.addEventListener('click', async () => {
    const spies = parseInt(document.getElementById('input-spies').value);
    const whiteHats = parseInt(document.getElementById('input-whitehats').value);

    Swal.showLoading();
    const res = await callEngine('start_game', { spies, whiteHats });
    Swal.close();

    if (res.status === 'error') {
        Swal.fire('Lỗi', res.message, 'error');
    }
});

// =========================================================================
// SỰ KIỆN PLAYING
// =========================================================================
const flipCard = () => keywordCard.classList.add('is-flipped');
const unflipCard = () => keywordCard.classList.remove('is-flipped');

// Hỗ trợ chuột và cảm ứng
keywordCard.addEventListener('mousedown', flipCard);
keywordCard.addEventListener('touchstart', flipCard);
keywordCard.addEventListener('mouseup', unflipCard);
keywordCard.addEventListener('mouseleave', unflipCard);
keywordCard.addEventListener('touchend', unflipCard);

btnGmMenu.addEventListener('click', () => {
    gmMenuContent.style.display = gmMenuContent.style.display === 'none' ? 'flex' : 'none';
});

btnResetRoom.addEventListener('click', async () => {
    const confirm = await Swal.fire({
        title: 'Bắt đầu ván mới?',
        text: "Hệ thống sẽ dọn dẹp kết quả cũ và đưa mọi người về lại phòng chờ để chia bài lại.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#007bff',
        cancelButtonColor: '#1f2833',
        confirmButtonText: 'Đồng ý'
    });

    if (confirm.isConfirmed) {
        await callEngine('reset_room');
        gmMenuContent.style.display = 'none'; // Ẩn menu
        fetchGameState(); // Lấy dữ liệu ngay lập tức
    }
});

btnCancelRoom.addEventListener('click', async () => {
    const confirm = await Swal.fire({
        title: 'Bạn có chắc chắn muốn hủy phòng?',
        text: "Mọi dữ liệu sẽ bị xóa!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4c4c',
        cancelButtonColor: '#1f2833',
        confirmButtonText: 'Hủy phòng ngay'
    });

    if (confirm.isConfirmed) {
        await callEngine('cancel_room');
    }
});

async function eliminatePlayer(targetId, targetName) {
    const confirm = await Swal.fire({
        title: `Loại bỏ ${targetName}?`,
        text: "Thao tác này không thể hoàn tác!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4c4c',
        cancelButtonColor: '#1f2833',
        confirmButtonText: 'Đồng ý Loại bỏ'
    });

    if (confirm.isConfirmed) {
        await callEngine('eliminate_player', { targetId });
    }
}

async function kickWaitingPlayer(targetId, targetName) {
    const confirm = await Swal.fire({
        title: `Kick ${targetName}?`,
        text: "Người này sẽ bị kick ra khỏi phòng!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4c4c',
        cancelButtonColor: '#1f2833',
        confirmButtonText: 'Kick ngay'
    });

    if (confirm.isConfirmed) {
        await callEngine('kick_player', { targetId });
    }
}

async function handleLeaveRoom() {
    const confirm = await Swal.fire({
        title: 'Bạn muốn thoát phòng?',
        text: isGM ? "Bạn là Quản Phòng. Nếu bạn thoát, phòng sẽ bị hủy!" : "Bạn sẽ rời khỏi phòng này.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4c4c',
        cancelButtonColor: '#1f2833',
        confirmButtonText: 'Đồng ý Thoát'
    });

    if (confirm.isConfirmed) {
        Swal.showLoading();
        await callEngine('leave_room');
        Swal.close();
        clearInterval(pollingInterval);
        sessionStorage.clear();
        location.reload();
    }
}

btnLeaveRoomWaiting.addEventListener('click', handleLeaveRoom);
btnLeaveRoomPlaying.addEventListener('click', handleLeaveRoom);

// =========================================================================
// POLLING LOGIC
// =========================================================================
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchGameState, 2000);
}

async function fetchGameState() {
    const res = await callEngine('get_state');
    if (res.status !== 'success') {
        // Lỗi đồng bộ = Phòng đã bị xóa hoặc không còn tồn tại
        if (res.message === 'Lỗi đồng bộ' || res.message === 'Phòng không tồn tại!') {
            clearInterval(pollingInterval);
            sessionStorage.clear(); // Xóa bộ nhớ tạm để không tự reconnect vào phòng cũ
            Swal.fire('Phòng đã đóng', 'Phòng này không còn tồn tại hoặc đã bị hủy.', 'info').then(() => location.reload());
        }
        return;
    }

    const { roomStatus, players, winner, waitingForWhiteHat } = res;

    // Kiểm tra xem bản thân có còn trong phòng không (bị đuổi)
    const amIStillInRoom = players.some(p => p.id === currentPlayerId);
    if (!amIStillInRoom && currentPlayerId) {
        clearInterval(pollingInterval);
        sessionStorage.clear();
        Swal.fire('Bị trục xuất', 'Bạn đã bị Chủ phòng đuổi khỏi phòng!', 'error').then(() => location.reload());
        return;
    }

    // Render danh sách chờ nếu phòng đang waiting
    if (roomStatus === 'waiting') {
        switchScreen('screen-waiting');
        renderWaitingPlayers(players);
        isShowingWinner = false; // Reset cờ winner nếu có
        notifiedEliminated.clear(); // Xóa lịch sử loại để ván mới dùng
    }

    // Nếu game bắt đầu
    if (roomStatus === 'playing') {
        switchScreen('screen-playing');
        
        // Quản phòng mới được thấy nút Menu (và danh sách nằm trong menu đó)
        if (isGM) {
            btnGmMenu.style.display = 'block';
            renderPlayingPlayers(players, winner);
        } else {
            btnGmMenu.style.display = 'none';
            gmMenuContent.style.display = 'none'; // Giấu luôn cả menu
        }

        // Hiện từ khóa cá nhân lên thẻ
        const myData = players.find(p => p.id === currentPlayerId);
        if (myData) {
            displayKeyword.innerText = myData.keyword;
        }

        // Xử lý Mũ trắng đoán chữ (Chỉ hiển thị cho người bị loại và là Mũ trắng)
        let isPromptingWhiteHat = false;
        if (waitingForWhiteHat === currentPlayerId) {
            isPromptingWhiteHat = true;
            // Mũ trắng hiện form đoán
            clearInterval(pollingInterval); // Tạm dừng poll tránh popup spam
            promptWhiteHatGuess();
        }

        // Xử lý thông báo người bị loại
        players.forEach(p => {
            if (p.status === 'Eliminated' && !notifiedEliminated.has(p.id)) {
                notifiedEliminated.add(p.id);
                // Nếu không phải là báo winner, thì báo người bị loại
                // KHÔNG báo toast nếu chính mình là Mũ trắng đang được yêu cầu đoán từ (tránh đè popup)
                if (!winner && !isPromptingWhiteHat) {
                    Swal.fire({
                        title: 'Có người bị loại!',
                        text: `${p.name} đã bị loại. Thân phận thực sự: ${p.role.toUpperCase()}`,
                        icon: 'info',
                        confirmButtonColor: '#66fcf1',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 4000,
                        timerProgressBar: true
                    });
                }
            }
        });

        // Xử lý game kết thúc
        if (winner && !isShowingWinner) {
            isShowingWinner = true;
            
            let title = '';
            let text = '';
            let icon = 'success';

            if (winner === 'villager') {
                title = 'DÂN THẮNG!';
                text = 'Toàn bộ Gián điệp đã bị tiêu diệt!';
            } else if (winner === 'spy') {
                title = 'GIÁN ĐIỆP THẮNG!';
                text = 'Gián điệp đã vượt mặt Dân!';
                icon = 'error';
            } else if (winner === 'white_hat') {
                title = 'MŨ TRẮNG THẮNG!';
                text = 'Mũ trắng đã cướp màn thành công!';
                icon = 'info';
            }

            Swal.fire({
                title: title,
                text: text,
                icon: icon,
                confirmButtonColor: '#66fcf1',
                confirmButtonText: 'Đóng',
                showDenyButton: isGM,
                denyButtonText: 'Bắt đầu ván mới',
                denyButtonColor: '#007bff',
                allowOutsideClick: false
            }).then(async (result) => {
                if (result.isDenied) {
                    await callEngine('reset_room');
                    fetchGameState(); // Lấy dữ liệu ngay lập tức
                }
            });
        }
    }

    currentGameState = res;
}

function renderWaitingPlayers(players) {
    waitingPlayerList.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item';
        
        let gmBadge = p.is_gm ? '<span class="gm-badge">GM</span>' : '';
        
        item.innerHTML = `
            <div class="player-info">
                <span class="player-name">${p.name} ${gmBadge}</span>
            </div>
        `;
        
        // Nút đuổi dành cho GM
        if (isGM && !p.is_gm) {
            const btn = document.createElement('button');
            btn.className = 'btn-danger';
            btn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Kick';
            btn.style.padding = '8px 12px';
            btn.onclick = () => kickWaitingPlayer(p.id, p.name);
            item.appendChild(btn);
        }

        waitingPlayerList.appendChild(item);
    });
}

function renderPlayingPlayers(players, winner) {
    playingPlayerList.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item' + (p.status === 'Eliminated' ? ' eliminated' : '');
        
        let gmBadge = p.is_gm ? '<span class="gm-badge">GM</span>' : '';
        
        // Khi game kết thúc, hiện toàn bộ role và keyword. Còn không thì ẩn.
        let roleDisplay = '';
        if (winner || p.status === 'Eliminated') {
            roleDisplay = `<span class="player-role">Thân phận: ${p.role} - Từ khóa: ${p.keyword}</span>`;
        }

        item.innerHTML = `
            <div class="player-info">
                <span class="player-name">${p.name} ${gmBadge} ${p.status === 'Eliminated' ? '(Đã loại)' : ''}</span>
                ${roleDisplay}
            </div>
        `;
        
        // Nút loại bỏ cho GM
        if (isGM && !winner && p.status === 'Alive') {
            const btn = document.createElement('button');
            btn.className = 'btn-danger';
            btn.innerHTML = '<i class="fa-solid fa-skull"></i>';
            btn.style.padding = '8px 12px';
            btn.onclick = () => eliminatePlayer(p.id, p.name);
            item.appendChild(btn);
        }

        playingPlayerList.appendChild(item);
    });
}

async function promptWhiteHatGuess() {
    const { value: guess } = await Swal.fire({
        title: 'BẠN LÀ MŨ TRẮNG',
        text: 'Bạn đã bị loại! Trận đấu phụ thuộc vào bạn. Hãy nhập từ khóa của phe Dân mà bạn nghe lỏm được:',
        input: 'text',
        inputPlaceholder: 'Nhập từ khóa...',
        showCancelButton: false,
        confirmButtonColor: '#66fcf1',
        confirmButtonText: 'Đoán',
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value) return 'Vui lòng không để trống!'
        }
    });

    if (guess) {
        const res = await callEngine('submit_whitehat_guess', { guessWord: guess });
        
        if (res.status === 'success') {
            await Swal.fire('Kết quả', res.message, 'info');
        }
        
        // Resume polling
        startPolling();
    } else {
        // Nếu lỡ bị tắt popup mà chưa nhập, bật lại polling để hiện lại popup
        startPolling();
    }
}

// =========================================================================
// KHÔI PHỤC TRẠNG THÁI (CHỐNG VĂNG KHI CHUYỂN TAB / TẮT MÀN HÌNH)
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    const savedRoom = sessionStorage.getItem('uc_roomCode');
    const savedPlayer = sessionStorage.getItem('uc_playerId');
    const savedName = sessionStorage.getItem('uc_playerName');
    const savedGM = sessionStorage.getItem('uc_isGM');

    if (savedRoom && savedPlayer) {
        // Khôi phục biến toàn cục
        currentRoomCode = savedRoom;
        currentPlayerId = savedPlayer;
        currentName = savedName;
        isGM = (savedGM === 'true');
        
        // Khôi phục giao diện
        displayRoomCode.innerText = currentRoomCode;
        displayPlayingRoomCode.innerText = currentRoomCode;
        displayPlayingName.innerText = currentName;
        
        if (isGM) gmSettings.style.display = 'flex';
        
        // Bắt đầu lấy dữ liệu luôn, hàm fetchGameState sẽ tự điều hướng đúng màn hình
        startPolling();
    }
});
