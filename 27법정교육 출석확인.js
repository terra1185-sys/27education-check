const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// 1. 교육 설정 (장소 확정 후 위도/경도를 여기서 수정하거나 관리자 페이지에서 변경)
let sessionConfig = {
    title: "2026 법정의무 집합교육 (3시간)",
    targetLat: 37.5665, // 추후 확정된 위도 넣기
    targetLng: 126.9780, // 추후 확정된 경도 넣기
    allowedRadiusMeters: 100, // 허용 반경 (100m)
    currentToken: "",
    tokenCreatedAt: Date.now()
};

// 출석 기록 DB (메모리 저장소)
let attendances = [];

// 2. 10초마다 바뀌는 동적 토큰 생성
function refreshQRToken() {
    sessionConfig.currentToken = crypto.randomBytes(8).toString('hex');
    sessionConfig.tokenCreatedAt = Date.now();
}
refreshQRToken();
setInterval(refreshQRToken, 10000);

// 두 좌표 간 거리 계산 (Haversine 공식)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// API: 출석 처리
app.post('/api/checkin', (req, res) => {
    const { token, type, name, phone, userLat, userLng } = req.body;

    // 1) 토큰 유효성 검사 (15초 이내 토큰만 허용)
    if (token !== sessionConfig.currentToken || (Date.now() - sessionConfig.tokenCreatedAt) > 15000) {
        return res.status(400).json({ error: "QR 코드가 만료되었습니다. 화면의 새 QR을 다시 스캔해 주세요." });
    }

    // 2) GPS 위치 검증
    const distance = getDistanceMeters(sessionConfig.targetLat, sessionConfig.targetLng, userLat, userLng);
    if (distance > sessionConfig.allowedRadiusMeters) {
        return res.status(400).json({ error: `교육장 범위를 벗어났습니다. (현재 거리가 교육장에서 ${Math.round(distance)}m 떨어짐)` });
    }

    // 3) 출석 저장
    const record = {
        id: attendances.length + 1,
        type, // '입실' 또는 '퇴실'
        name,
        phone,
        time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        distance: Math.round(distance)
    };
    attendances.push(record);

    res.json({ success: true, message: `${type} 출석체크가 정상 완료되었습니다!`, record });
});

// API: 교육장 좌표 변경 (장소 확정 시 사용)
app.post('/api/config', (req, res) => {
    const { targetLat, targetLng, radius } = req.body;
    if (targetLat) sessionConfig.targetLat = parseFloat(targetLat);
    if (targetLng) sessionConfig.targetLng = parseFloat(targetLng);
    if (radius) sessionConfig.allowedRadiusMeters = parseInt(radius);
    res.json({ success: true, sessionConfig });
});

// API: 강사 화면용 QR 및 출석 현황 데이터 전달
app.get('/api/dashboard', (req, res) => {
    res.json({
        config: sessionConfig,
        attendances: attendances
    });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));