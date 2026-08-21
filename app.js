const ENGINE_URL = 'https://izrdxpbpmicatdtelkzo.supabase.co/functions/v1/undercover-engine';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cmR4cGJwbWljYXRkdGVsa3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzcyMTIsImV4cCI6MjEwMTI1MzIxMn0.6U_jsCLJRl3wGXQqoL7-A5SfMaKATXDHFnHA3zsjHyE';

const supabaseClient = window.supabase.createClient('https://izrdxpbpmicatdtelkzo.supabase.co', SUPABASE_ANON_KEY);

// =========================================================================
// BIẾN TOÀN CỤC
// =========================================================================
let currentRoomCode = null;
let currentPlayerId = null;
let currentName = null;
let isGM = false;
let realtimeChannel = null;
let isToggling = false;
let currentGameState = null;
let notifiedEliminated = new Set();
let isShowingWinner = false;
let isPromptingWhiteHat = false;
let notifiedWaitingWhiteHat = false;

// =========================================================================
// CUSTOM UI (Thay thế SweetAlert2)
// =========================================================================
const CustomUI = {
    modalQueue: [],
    isModalShowing: false,
    toastContainer: document.getElementById('toast-container'),
    modalOverlay: document.getElementById('custom-modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalFooter: document.getElementById('modal-footer'),
    modalIcon: document.getElementById('modal-icon'),

    fire: function(arg1, arg2, arg3) {
        let options = {};
        if (typeof arg1 === 'string') {
            options = { title: arg1, text: arg2 || '', icon: arg3 };
        } else {
            options = arg1;
        }

        if (options.toast) {
            this.showToast(options);
            return Promise.resolve({ isConfirmed: false, isDenied: false });
        }

        return new Promise((resolve) => {
            this.modalQueue.push({ options, resolve });
            this.processQueue();
        });
    },

    showLoading: function() {
        this.fire({
            title: 'Đang xử lý...',
            text: '<div class="loader-spinner"></div>',
            showConfirmButton: false,
            allowOutsideClick: false
        });
    },

    close: function() {
        // Xóa modal loading đang hiện (nếu có)
        if (this.isModalShowing && this.modalQueue[0]?.options.showConfirmButton === false) {
            this.hideModal();
        } else {
            // Hoặc xóa khỏi queue nếu chưa kịp hiện
            this.modalQueue = this.modalQueue.filter(m => m.options.showConfirmButton !== false);
        }
    },

    processQueue: function() {
        if (this.isModalShowing || this.modalQueue.length === 0) return;
        const { options, resolve } = this.modalQueue[0];
        this.showModal(options, resolve);
    },

    showModal: function(options, resolve) {
        this.isModalShowing = true;
        
        this.modalTitle.innerText = options.title || '';
        this.modalBody.innerHTML = options.text || '';
        
        let iconClass = 'fa-solid fa-circle-info';
        let iconColor = 'var(--accent)';
        if (options.icon === 'success') { iconClass = 'fa-solid fa-circle-check'; iconColor = '#66fcf1'; }
        if (options.icon === 'error') { iconClass = 'fa-solid fa-circle-xmark'; iconColor = 'var(--danger)'; }
        if (options.icon === 'warning') { iconClass = 'fa-solid fa-triangle-exclamation'; iconColor = '#ffc107'; }
        if (options.icon === 'question') { iconClass = 'fa-solid fa-circle-question'; iconColor = '#007bff'; }
        
        this.modalIcon.className = iconClass;
        this.modalIcon.style.color = iconColor;
        this.modalIcon.style.display = options.icon ? 'block' : 'none';

        if (options.input === 'text') {
            const inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.placeholder = options.inputPlaceholder || '';
            inputEl.id = 'custom-modal-input';
            this.modalBody.appendChild(inputEl);
        }

        this.modalFooter.innerHTML = '';
        
        const showConfirm = options.showConfirmButton !== false;
        if (showConfirm) {
            const confirmBtn = document.createElement('button');
            confirmBtn.innerText = options.confirmButtonText || 'OK';
            confirmBtn.style.background = options.confirmButtonColor || 'var(--accent)';
            confirmBtn.style.color = 'var(--bg-color)';
            confirmBtn.onclick = () => {
                let value = null;
                if (options.input === 'text') {
                    const inputEl = document.getElementById('custom-modal-input');
                    value = inputEl.value.trim();
                    if (options.inputValidator) {
                        const err = options.inputValidator(value);
                        if (err) {
                            this.showToast({ icon: 'error', title: err });
                            return;
                        }
                    }
                }
                this.hideModal();
                resolve({ isConfirmed: true, isDenied: false, value });
            };
            this.modalFooter.appendChild(confirmBtn);
        }

        if (options.showDenyButton) {
            const denyBtn = document.createElement('button');
            denyBtn.innerText = options.denyButtonText || 'Không';
            denyBtn.style.background = options.denyButtonColor || 'var(--danger)';
            denyBtn.style.color = 'white';
            denyBtn.onclick = () => {
                this.hideModal();
                resolve({ isConfirmed: false, isDenied: true });
            };
            this.modalFooter.appendChild(denyBtn);
        }

        if (options.showCancelButton) {
            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = options.cancelButtonText || 'Hủy';
            cancelBtn.style.background = options.cancelButtonColor || 'var(--panel-bg)';
            cancelBtn.style.border = '1px solid #888';
            cancelBtn.style.color = 'white';
            cancelBtn.onclick = () => {
                this.hideModal();
                resolve({ isConfirmed: false, isDenied: false });
            };
            this.modalFooter.appendChild(cancelBtn);
        }

        if (this.modalFooter.children.length === 0) {
            this.modalFooter.style.display = 'none';
        } else {
            this.modalFooter.style.display = 'flex';
        }

        this.modalOverlay.classList.remove('hidden');
    },

    hideModal: function() {
        this.modalOverlay.classList.add('hidden');
        this.isModalShowing = false;
        this.modalQueue.shift(); // Xóa khỏi hàng đợi
        setTimeout(() => this.processQueue(), 300); // Chờ animation 0.3s
    },

    showToast: function(options) {
        const toast = document.createElement('div');
        toast.className = `custom-toast ${options.icon === 'error' ? 'error' : ''}`;
        
        let icon = 'fa-solid fa-circle-info';
        if (options.icon === 'error') icon = 'fa-solid fa-circle-xmark';
        
        const titleHtml = options.title ? `<b>${options.title}</b><br/>` : '';
        const textHtml = options.text ? `${options.text}` : '';
        
        toast.innerHTML = `<i class="${icon}"></i> <span>${titleHtml}${textHtml}</span>`;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 4000); // Khớp với animation CSS (0.3s + 3.7s)
    }
};

// Gắn đè CustomUI vào tên Swal để toàn bộ code cũ hoạt động bình thường
const Swal = CustomUI;

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
const waitingCount = document.getElementById('waiting-count');
const checkboxRevealWaiting = document.getElementById('checkbox-reveal-waiting');

// Playing
const keywordCard = document.getElementById('keyword-card');
const displayKeyword = document.getElementById('display-keyword');
const playingPlayerList = document.getElementById('playing-player-list');
const btnGmMenu = document.getElementById('btn-gm-menu');
const gmMenuContent = document.getElementById('gm-menu-content');
const btnCancelRoom = document.getElementById('btn-cancel-room');
const btnResetRoom = document.getElementById('btn-reset-room');
const btnToggleRevealPlaying = document.getElementById('btn-toggle-reveal-playing');
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
// Custom Dropdown Logic
document.getElementById('wordpack-trigger')?.addEventListener('click', (e) => {
    const options = document.getElementById('wordpack-options');
    const wrapper = e.currentTarget.parentElement;
    if (options.style.display === 'none' || !options.style.display) {
        options.style.display = 'block';
        wrapper.classList.add('open');
    } else {
        options.style.display = 'none';
        wrapper.classList.remove('open');
    }
});

document.querySelectorAll('.custom-option').forEach(option => {
    option.addEventListener('click', (e) => {
        const val = option.getAttribute('data-value');
        const text = option.innerHTML;
        
        const triggerSpan = document.querySelector('#wordpack-trigger span');
        if (triggerSpan) triggerSpan.innerHTML = text;
        
        const hiddenInput = document.getElementById('input-wordpack');
        if (hiddenInput) hiddenInput.value = val;
        
        document.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        const options = document.getElementById('wordpack-options');
        options.style.display = 'none';
        options.parentElement.classList.remove('open');
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        const options = document.getElementById('wordpack-options');
        if(options) {
            options.style.display = 'none';
            options.parentElement.classList.remove('open');
        }
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
        
        // Lưu vào localStorage để chống văng tuyệt đối
        localStorage.setItem('uc_roomCode', currentRoomCode);
        localStorage.setItem('uc_playerId', currentPlayerId);
        localStorage.setItem('uc_playerName', currentName);
        localStorage.setItem('uc_isGM', isGM);
        // Hẹn giờ tự hủy 2 tiếng
        localStorage.setItem('uc_expiry', Date.now() + 2 * 60 * 60 * 1000);

        displayRoomCode.innerText = currentRoomCode;
        displayPlayingRoomCode.innerText = currentRoomCode;
        displayPlayingName.innerText = currentName;
        if (isGM) gmSettings.style.display = 'flex';
        
        switchScreen('screen-waiting');
        setupRealtime();
        fetchGameState();
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
    const wordPackStr = document.getElementById('input-wordpack')?.value;
    const wordPack = wordPackStr ? parseInt(wordPackStr, 10) : 0;

    Swal.showLoading();
    const res = await callEngine('start_game', { spies, whiteHats, wordPack });
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

// =========================================================================
// UTILS GIAO DIỆN NÚT BẤM
// =========================================================================
function updateToggleButtonUI(revealRoles) {
    if (!btnToggleRevealPlaying) return;
    const span = btnToggleRevealPlaying.querySelector('span');
    const icon = btnToggleRevealPlaying.querySelector('i');
    if (revealRoles) {
        span.innerText = 'Lộ diện: ĐANG BẬT';
        icon.className = 'fa-solid fa-eye';
        btnToggleRevealPlaying.style.color = 'var(--accent)';
        btnToggleRevealPlaying.style.borderColor = 'var(--accent)';
    } else {
        span.innerText = 'Lộ diện: ĐANG TẮT';
        icon.className = 'fa-solid fa-eye-slash';
        btnToggleRevealPlaying.style.color = '#888';
        btnToggleRevealPlaying.style.borderColor = '#888';
    }
}

checkboxRevealWaiting.addEventListener('change', async (e) => {
    isToggling = true;
    updateToggleButtonUI(e.target.checked);
    await callEngine('toggle_reveal_roles');
    isToggling = false;
});

if (btnToggleRevealPlaying) {
    btnToggleRevealPlaying.addEventListener('click', async () => {
        isToggling = true;
        // Lấy trạng thái hiện tại từ text của nút
        const isCurrentlyOn = btnToggleRevealPlaying.querySelector('span').innerText.includes('BẬT');
        const newState = !isCurrentlyOn;
        
        // Optimistic UI update
        updateToggleButtonUI(newState);
        if (checkboxRevealWaiting) checkboxRevealWaiting.checked = newState;
        
        await callEngine('toggle_reveal_roles');
        isToggling = false;
    });
}

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
        Swal.showLoading();
        await callEngine('kick_player', { targetId });
        await fetchGameState(); // Ép cập nhật danh sách vì Realtime bỏ qua lệnh Delete
        Swal.close();
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
        if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
        localStorage.clear();
        location.reload();
    }
}

btnLeaveRoomWaiting.addEventListener('click', handleLeaveRoom);
btnLeaveRoomPlaying.addEventListener('click', handleLeaveRoom);

// =========================================================================
// WEBSOCKETS LOGIC (SUPABASE REALTIME)
// =========================================================================
function setupRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }
    realtimeChannel = supabaseClient.channel('room_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_rooms', filter: `room_code=eq.${currentRoomCode}` }, () => {
            fetchGameState();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_players', filter: `room_code=eq.${currentRoomCode}` }, () => {
            fetchGameState();
        })
        .subscribe();
}

async function fetchGameState() {
    const res = await callEngine('get_state');
    
    // Tự động đóng Modal Loading (CustomUI sẽ tự biết bỏ qua nếu modal đang hiện không phải là Loading)
    Swal.close();

    if (res.status !== 'success') {
        // Lỗi đồng bộ = Phòng đã bị xóa hoặc không còn tồn tại
        if (res.message === 'Lỗi đồng bộ' || res.message === 'Phòng không tồn tại!') {
            if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
            localStorage.clear(); // Xóa bộ nhớ để không bị kẹt phòng cũ
            Swal.fire('Phòng đã đóng', 'Phòng này không còn tồn tại hoặc đã bị hủy.', 'info').then(() => location.reload());
        }
        return;
    }

    const { roomStatus, players, winner, waitingForWhiteHat, revealRoles, spies, whiteHats, wordPack } = res;

    if (isGM && !isToggling) {
        if (checkboxRevealWaiting) checkboxRevealWaiting.checked = revealRoles;
        updateToggleButtonUI(revealRoles);
    }

    // Kiểm tra xem bản thân có còn trong phòng không (bị đuổi)
    const amIStillInRoom = players.some(p => p.id === currentPlayerId);
    if (!amIStillInRoom && currentPlayerId) {
        if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
        localStorage.clear();
        Swal.fire('Bị trục xuất', 'Bạn đã bị Chủ phòng đuổi khỏi phòng!', 'error').then(() => location.reload());
        return;
    }

    // Render danh sách chờ nếu phòng đang waiting
    if (roomStatus === 'waiting') {
        switchScreen('screen-waiting');
        renderWaitingPlayers(players);
        isShowingWinner = false; // Reset cờ winner nếu có
        notifiedEliminated.clear(); // Xóa lịch sử loại để ván mới dùng
        
        // Khôi phục cài đặt số lượng từ ván trước (nếu có)
        if (isGM) {
            if (spies !== undefined && spies !== null) document.getElementById('input-spies').value = spies;
            if (whiteHats !== undefined && whiteHats !== null) document.getElementById('input-whitehats').value = whiteHats;
            if (wordPack !== undefined && wordPack !== null) {
                const el = document.getElementById('input-wordpack');
                if (el) el.value = wordPack;
                const targetOption = document.querySelector(`.custom-option[data-value="${wordPack}"]`);
                if (targetOption) {
                    const triggerSpan = document.querySelector('#wordpack-trigger span');
                    if (triggerSpan) triggerSpan.innerHTML = targetOption.innerHTML;
                    document.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                    targetOption.classList.add('selected');
                }
            }
        }
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
        if (waitingForWhiteHat) {
            if (waitingForWhiteHat === currentPlayerId && !isPromptingWhiteHat) {
                isPromptingWhiteHat = true;
                // Mũ trắng hiện form đoán
                promptWhiteHatGuess();
            } else if (waitingForWhiteHat !== currentPlayerId && !notifiedWaitingWhiteHat) {
                notifiedWaitingWhiteHat = true;
                Swal.fire({
                    title: 'Trận đấu sinh tử!',
                    text: 'Mũ Trắng đang nhập từ khóa để phân định thắng bại...',
                    icon: 'warning',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 6000,
                    timerProgressBar: true
                });
            }
        } else {
            notifiedWaitingWhiteHat = false;
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
    if (waitingCount) waitingCount.innerText = players.length;
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
        text: 'Bạn đã bị lộ thân phận Mũ Trắng! Trận đấu phụ thuộc vào bạn. Hãy nhập từ khóa của phe Dân mà bạn nghe lỏm được:',
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
        
        isPromptingWhiteHat = false;
        // Cập nhật lại UI sau khi đóng Swal
        fetchGameState();
    } else {
        isPromptingWhiteHat = false;
        // Nếu lỡ bị tắt popup mà chưa nhập, hiển thị lại khi có fetch mới
        fetchGameState();
    }
}

// =========================================================================
// KHÔI PHỤC TRẠNG THÁI (CHỐNG VĂNG KHI CHUYỂN TAB / TẮT MÀN HÌNH)
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    const savedRoom = localStorage.getItem('uc_roomCode');
    const savedPlayer = localStorage.getItem('uc_playerId');
    const savedName = localStorage.getItem('uc_playerName');
    const savedGM = localStorage.getItem('uc_isGM');
    const expiry = localStorage.getItem('uc_expiry');

    // Tự động dọn rác nếu quá thời hạn 2 tiếng
    if (expiry && Date.now() > parseInt(expiry)) {
        localStorage.clear();
        return;
    }

    if (savedRoom && savedPlayer) {
        // Gia hạn thêm 2 tiếng mỗi khi tải lại trang
        localStorage.setItem('uc_expiry', Date.now() + 2 * 60 * 60 * 1000);

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
        setupRealtime();
        
        // Hiện Màn hình Loading kết nối lại ngay lập tức bằng CustomUI
        Swal.fire({
            title: 'Đang kết nối lại...',
            text: '<div class="loader-spinner"></div> <br/><br/> Vui lòng chờ...',
            showConfirmButton: false, // Báo cho CustomUI biết đây là Loading Modal
            allowOutsideClick: false
        });

        // Bắt đầu đếm ngược 20s chặn treo mạng
        const reconnectTimeout = setTimeout(() => {
            Swal.close(); // Tắt Loading modal hiện tại để dọn chỗ cho modal Mạng yếu
            Swal.fire({
                icon: 'warning',
                title: 'Mạng yếu!',
                text: 'Mất quá nhiều thời gian để kết nối đến Máy chủ. Vui lòng thử lại!',
                showConfirmButton: true,
                confirmButtonText: 'Kết nối lại',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    location.reload();
                }
            });
        }, 20000);

        // Chạy fetch và hủy hẹn giờ nếu fetch xong trước 20s
        fetchGameState().then(() => {
            clearTimeout(reconnectTimeout);
        });
    }
});

// =========================================================================
// SỰ KIỆN ĐÁNH THỨC (VISIBILITY CHANGE)
// =========================================================================
document.addEventListener('visibilitychange', () => {
    // Khi người chơi bật sáng màn hình hoặc quay lại tab
    if (document.visibilityState === 'visible') {
        // Nếu đang ở trong phòng, lập tức cập nhật dữ liệu để tránh lỡ nhịp (Stale state)
        if (currentRoomCode) {
            fetchGameState();
        }
    }
});
