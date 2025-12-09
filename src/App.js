import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth, signInWithGoogle, logout, db, logInWithEmail, registerWithEmail, sendPasswordReset, updateUserProfile } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch, query, orderBy, limit, where, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import Lottie from "lottie-react";
import { FaCog, FaPlus, FaSignOutAlt, FaChevronRight, FaChevronLeft, FaPen, FaTrash, FaCloudUploadAlt, FaChartBar, FaFire, FaTrophy, FaUserFriends, FaCrown, FaSearch, FaGoogle, FaEnvelope, FaLock, FaUser } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

// --- ЗВУКИ ---
const TROPHY_ANIMATION_URL = "https://assets10.lottiefiles.com/packages/lf20_touohxv0.json";
const CLICK_SOUND = "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"; 
const SUCCESS_SOUND = "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"; 
const playClick = () => { const a = new Audio(CLICK_SOUND); a.volume = 0.3; a.play().catch(() => {}); };
const playSuccess = () => { const a = new Audio(SUCCESS_SOUND); a.volume = 0.4; a.play().catch(() => {}); };

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const INITIAL_QUOTES_DB = [{ text: "Боль дисциплины весит граммы, а боль сожаления — тонны." }, { text: "Результаты не приходят за одну ночь. Будь терпелив." }];

const RANKS = [
  { name: "Новичок", threshold: 0 }, 
  { name: "Любитель", threshold: 500 }, 
  { name: "Атлет", threshold: 1500 },
  { name: "Мастер", threshold: 4000 }, 
  { name: "Машина", threshold: 10000 }, 
  { name: "Киборг", threshold: 25000 }, 
  { name: "Легенда", threshold: 50000 }
];

function App() {
  const [user, loading] = useAuthState(auth);

  // --- Auth State ---
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // --- App Data ---
  const [exercises, setExercises] = useState([{ name: 'Отжимания', target: 50, count: 0, lifetime: 0, xpPerRep: 1, unit: 'раз' }]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [streak, setStreak] = useState(0);
  
  const [totalXP, setTotalXP] = useState(0); 
  const [totalLifetimeCount, setTotalLifetimeCount] = useState(0);

  // --- UI ---
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  
  // --- Leaderboard & Stats Logic ---
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedLeaderboardExercise, setSelectedLeaderboardExercise] = useState('Отжимания');
  const [selectedStatsExercise, setSelectedStatsExercise] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [friendEmailInput, setFriendEmailInput] = useState("");
  const [friendSearchStatus, setFriendSearchStatus] = useState("");
  
  const [trophyData, setTrophyData] = useState(null);
  const [settings, setSettings] = useState({ notify: false, times: ['10:00'], days: [] });
  const [quote, setQuote] = useState("Загрузка...");
  const [allQuotes, setAllQuotes] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [statsRange, setStatsRange] = useState('week');
  
  const getCurrentRank = (xp) => RANKS.slice().reverse().find(r => xp >= r.threshold) || RANKS[0];
  const getNextRank = (xp) => RANKS.find(r => r.threshold > xp);

  // --- 1. Init ---
  useEffect(() => {
    fetch(TROPHY_ANIMATION_URL).then(r => r.ok ? r.json() : null).then(setTrophyData).catch(() => {});
    const fetchQuotes = async () => {
      try {
        const snap = await getDocs(collection(db, "quotes"));
        const q = snap.docs.map(d => d.data().text);
        if (q.length) { setAllQuotes(q); setQuote(q[Math.floor(Math.random() * q.length)]); }
      } catch (e) {}
    };
    fetchQuotes();
  }, []);
  
  useEffect(() => {
      if(allQuotes.length) {
          const interval = setInterval(() => setQuote(allQuotes[Math.floor(Math.random() * allQuotes.length)]), 60000);
          return () => clearInterval(interval);
      }
  }, [allQuotes]);

  // --- 2. Logic ---
  const checkDateAndReset = useCallback(async (forceUserCheck = null) => {
    const currentUser = forceUserCheck || user;
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const docRef = doc(db, 'users', currentUser.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      setTotalLifetimeCount(data.totalLifetimeCount || 0);
      setTotalXP(data.totalXP !== undefined ? data.totalXP : (data.totalLifetimeCount || 0));

      let newStreak = data.streak || 0;
      if (data.lastDate !== today && data.lastDate !== yesterday) newStreak = 0;

      if (data.lastDate !== today) {
        const hasActivity = data.exercises.some(ex => ex.count > 0);
        if (hasActivity && data.lastDate === yesterday) newStreak += 1;
        if (hasActivity) {
          const historyRef = doc(collection(db, `users/${currentUser.uid}/history`), data.lastDate);
          await setDoc(historyRef, { date: data.lastDate, exercises: data.exercises, timestamp: new Date() });
        }
        const resetExercises = data.exercises.map(ex => ({ ...ex, count: 0 }));
        await updateDoc(docRef, { exercises: resetExercises, lastDate: today, streak: newStreak });
        setExercises(resetExercises); setStreak(newStreak);
      } else {
        const loadedExercises = data.exercises.map(ex => ({
             ...ex, 
             lifetime: ex.lifetime !== undefined ? ex.lifetime : ex.count,
             xpPerRep: ex.xpPerRep !== undefined ? ex.xpPerRep : 1,
             unit: ex.unit || 'раз'
        }));
        setExercises(loadedExercises); 
        setStreak(newStreak);
      }
      if (data.settings) setSettings(data.settings);
    } else {
      const initialData = {
        exercises: [{ name: 'Отжимания', target: 50, count: 0, lifetime: 0, xpPerRep: 1, unit: 'раз' }],
        lastDate: today,
        settings: { notify: false, times: ['10:00'], days: [] },
        streak: 0,
        totalLifetimeCount: 0,
        totalXP: 0,
        email: currentUser.email,
        displayName: currentUser.displayName || name || "Аноним"
      };
      await setDoc(docRef, initialData);
      setExercises(initialData.exercises);
      setSettings(initialData.settings);
    }
  }, [user, name]);

  useEffect(() => { if (user) checkDateAndReset(); }, [user, checkDateAndReset]);

  // --- Auth Handlers ---
  const handleLogin = async (e) => { e.preventDefault(); setAuthError(''); try { await logInWithEmail(email, password); } catch (err) { setAuthError(err.message); } };
  const handleRegister = async (e) => { e.preventDefault(); setAuthError(''); try { const res = await registerWithEmail(email, password); await updateUserProfile(res.user, name); } catch (err) { setAuthError(err.message); } };
  const handleResetPassword = async (e) => { e.preventDefault(); setAuthError(''); setResetSent(false); try { await sendPasswordReset(email); setResetSent(true); } catch (err) { setAuthError(err.message); } };

  // --- Stats & Leaderboard ---
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const historyRef = collection(db, `users/${user.uid}/history`);
    const q = query(historyRef, orderBy("date", "desc"), limit(365));
    const snap = await getDocs(q);
    setHistoryData(snap.docs.map(d => d.data()).reverse());
  }, [user]);

  const fetchLeaderboard = useCallback(async (exerciseName) => {
    try {
      const q = query(collection(db, "globalStats"), where("exercise", "==", exerciseName), orderBy("count", "desc"), limit(10));
      const snap = await getDocs(q);
      setLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setLeaderboard([]); }
  }, []);

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const docSnap = await getDoc(doc(db, 'users', user.uid));
    const friendIds = docSnap.data()?.friends || [];
    if (friendIds.length > 0) {
      const q = query(collection(db, "users"), where("__name__", "in", friendIds.slice(0, 10)));
      const snap = await getDocs(q);
      setFriendsList(snap.docs.map(d => d.data()));
    } else setFriendsList([]);
  }, [user]);

  useEffect(() => {
      if (showStats) {
          fetchHistory();
          if (!selectedStatsExercise && exercises.length > 0) setSelectedStatsExercise(exercises[currentIdx].name);
      } 
  }, [showStats, user, currentIdx, exercises]);

  useEffect(() => {
      if (showSocial) {
          fetchFriends();
          if(exercises.length > 0) {
             const exName = exercises[currentIdx].name;
             setSelectedLeaderboardExercise(exName);
             fetchLeaderboard(exName);
          }
      }
  }, [showSocial, exercises, currentIdx, fetchLeaderboard, fetchFriends]);

  const addFriend = async () => {
    if (!friendEmailInput) return;
    setFriendSearchStatus("Поиск...");
    const q = query(collection(db, "users"), where("email", "==", friendEmailInput));
    const snap = await getDocs(q);
    if (snap.empty) return setFriendSearchStatus("Пользователь не найден 😞");
    const friendId = snap.docs[0].id;
    if (friendId === user.uid) return setFriendSearchStatus("Это же вы! 😅");
    await updateDoc(doc(db, "users", user.uid), { friends: arrayUnion(friendId) });
    setFriendSearchStatus("Друг добавлен! 🎉"); setFriendEmailInput(""); fetchFriends();
  };

  const updateProgress = async (val) => {
    playClick();
    const num = parseInt(val); if (isNaN(num)) return;
    const upd = [...exercises];
    
    const old = upd[currentIdx].count;
    upd[currentIdx].count += num;
    const currentLifetime = upd[currentIdx].lifetime || 0;
    const newLifetime = currentLifetime + num;
    upd[currentIdx].lifetime = newLifetime;

    const newTotalCount = totalLifetimeCount + num;
    const difficulty = upd[currentIdx].xpPerRep || 1;
    const xpGained = num * difficulty;
    const newTotalXP = totalXP + xpGained;

    setTotalLifetimeCount(newTotalCount);
    setTotalXP(newTotalXP);

    if (old < upd[currentIdx].target && upd[currentIdx].count >= upd[currentIdx].target) triggerCelebration();
    setExercises(upd); setInputValue('');

    if (user) {
        await updateDoc(doc(db, 'users', user.uid), { 
            exercises: upd, 
            totalLifetimeCount: newTotalCount,
            totalXP: newTotalXP, 
            email: user.email, 
            displayName: user.displayName 
        });
        const globalStatRef = doc(db, "globalStats", `${user.uid}_${exercises[currentIdx].name}`);
        await setDoc(globalStatRef, {
            userId: user.uid,
            displayName: user.displayName || "Аноним",
            exercise: exercises[currentIdx].name,
            count: newLifetime
        });
    }
  };

  const triggerCelebration = () => { setShowCelebration(true); playSuccess(); setTimeout(() => setShowCelebration(false), 5000); };
  
  // --- НОВАЯ ФУНКЦИЯ ДОБАВЛЕНИЯ УПРАЖНЕНИЯ ---
  const handleAddExercise = async (e) => {
    e.preventDefault(); 
    playSuccess();
    
    const n = e.target.name.value;
    const t = e.target.target.value;
    const xp = e.target.xp.value;
    const unit = e.target.unit.value; 

    const newEx = { 
        name: n, 
        target: parseInt(t), 
        count: 0, 
        lifetime: 0, 
        xpPerRep: parseFloat(xp),
        unit: unit 
    };

    const u = [...exercises, newEx];
    setExercises(u); 
    if(user) await updateDoc(doc(db, 'users', user.uid), { exercises: u }); 
    setShowAddModal(false); 
    setCurrentIdx(u.length - 1); 
  };

  // --- УМНЫЕ КНОПКИ ---
  const getQuickButtons = () => {
    const t = exercises[currentIdx].target;
    if (t <= 15) return [1, 3, 5];
    if (t <= 60) return [5, 10, 20];
    return [10, 25, 50];
  };

  const getChartData = () => {
    const days = statsRange === 'week' ? 7 : 30;
    const sliced = historyData.slice(-days);
    const name = selectedStatsExercise || exercises[0]?.name;
    return sliced.map(e => {
      const exData = e.exercises.find(ex => ex.name === name);
      return { date: new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }), count: exData ? exData.count : 0 };
    });
  };
  const getHeatmapData = () => historyData.map(d => ({ date: d.date, count: d.exercises.reduce((a, c) => a + c.count, 0) }));

  const currentRank = getCurrentRank(totalXP);
  const nextRank = getNextRank(totalXP);
  const progressToNextRank = nextRank ? ((totalXP - currentRank.threshold) / (nextRank.threshold - currentRank.threshold)) * 100 : 100;

  if (loading) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Загрузка...</div>;
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
          <h1 className="text-4xl font-bold text-center mb-6 text-blue-500">FitTracker</h1>
          {authMode === 'login' && (<form onSubmit={handleLogin} className="flex flex-col gap-4"><h2 className="text-xl font-bold text-center mb-2">Вход</h2><div className="relative"><FaEnvelope className="absolute top-4 left-3 text-gray-500"/><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required /></div><div className="relative"><FaLock className="absolute top-4 left-3 text-gray-500"/><input type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required /></div>{authError && <p className="text-red-400 text-sm text-center">{authError}</p>}<button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition">Войти</button><div className="flex justify-between text-sm text-gray-400 mt-2"><button type="button" onClick={()=>setAuthMode('reset')} className="hover:text-white">Забыли пароль?</button><button type="button" onClick={()=>setAuthMode('register')} className="hover:text-white">Регистрация</button></div></form>)}
          {authMode === 'register' && (<form onSubmit={handleRegister} className="flex flex-col gap-4"><h2 className="text-xl font-bold text-center mb-2">Регистрация</h2><div className="relative"><FaUser className="absolute top-4 left-3 text-gray-500"/><input type="text" placeholder="Ваше имя" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required /></div><div className="relative"><FaEnvelope className="absolute top-4 left-3 text-gray-500"/><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required /></div><div className="relative"><FaLock className="absolute top-4 left-3 text-gray-500"/><input type="password" placeholder="Пароль (мин. 6 симв.)" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required /></div>{authError && <p className="text-red-400 text-sm text-center">{authError}</p>}<button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded transition">Создать аккаунт</button><button type="button" onClick={()=>setAuthMode('login')} className="text-sm text-gray-400 hover:text-white mt-2">Уже есть аккаунт? Войти</button></form>)}
          {authMode === 'reset' && (<form onSubmit={handleResetPassword} className="flex flex-col gap-4"><h2 className="text-xl font-bold text-center mb-2">Сброс пароля</h2><div className="relative"><FaEnvelope className="absolute top-4 left-3 text-gray-500"/><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-gray-700 p-3 pl-10 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required /></div>{resetSent && <p className="text-green-400 text-sm text-center">Ссылка отправлена!</p>}{authError && <p className="text-red-400 text-sm text-center">{authError}</p>}<button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition">Отправить</button><button type="button" onClick={()=>setAuthMode('login')} className="text-sm text-gray-400 hover:text-white mt-2">Назад</button></form>)}
          <div className="flex items-center my-6"><div className="flex-1 h-px bg-gray-600"></div><span className="px-3 text-gray-500 text-sm">ИЛИ</span><div className="flex-1 h-px bg-gray-600"></div></div>
          <button onClick={signInWithGoogle} className="w-full bg-white text-gray-900 font-bold py-3 rounded flex items-center justify-center gap-2 hover:bg-gray-100 transition"><FaGoogle className="text-red-500"/> Войти через Google</button>
        </motion.div>
      </div>
    );
  }

  const currentExercise = exercises[currentIdx];
  const progressPercent = Math.min((currentExercise.count / currentExercise.target) * 100, 100);
  const strokeDashoffset = (2 * Math.PI * 120) - (progressPercent / 100) * (2 * Math.PI * 120);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans relative overflow-hidden flex flex-col items-center select-none">
      <AnimatePresence>
        {showCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowCelebration(false)}>
            <div className="absolute inset-0 pointer-events-none"><Confetti numberOfPieces={400} recycle={true} /></div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-64 h-64 md:w-96 md:h-96 flex items-center justify-center">
              {trophyData ? <Lottie animationData={trophyData} loop={true} /> : <span className="text-9xl">🏆</span>}
            </motion.div>
            <h2 className="text-4xl font-extrabold text-yellow-400 mt-4">ЦЕЛЬ ДОСТИГНУТА!</h2>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="w-full p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex gap-2 items-center">
          <button onClick={() => { playClick(); setShowAddModal(true) }} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-lg border border-gray-700"><FaPlus /></button>
          <button onClick={() => { playClick(); setShowStats(true) }} className="p-3 bg-blue-600/20 text-blue-400 rounded-full hover:bg-blue-600/40 transition shadow-lg border border-blue-900/30"><FaChartBar /></button>
          <button onClick={() => { playClick(); setShowSocial(true) }} className="p-3 bg-yellow-600/20 text-yellow-400 rounded-full hover:bg-yellow-600/40 transition relative shadow-lg border border-yellow-900/30"><FaCrown /></button>
          <div className="hidden md:flex items-center gap-1 bg-gray-800/80 px-3 py-1.5 rounded-full border border-orange-500/30 shadow-lg">
            <FaFire className={streak > 0 ? "text-orange-500 animate-pulse" : "text-gray-600"} />
            <span className={`font-bold text-sm ${streak > 0 ? "text-orange-100" : "text-gray-500"}`}>{streak}</span>
          </div>
        </div>
        <button onClick={() => { playClick(); setShowSettings(true) }} className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition shadow-lg border border-gray-700"><FaCog /></button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md px-4">
        {/* Quote & XP Bar */}
        <div className="w-full flex flex-col items-center mb-6">
           <div className="h-8 flex items-center justify-center text-center text-gray-400 italic text-xs mb-2">
             <motion.div key={quote} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>{quote}</motion.div>
           </div>
           
           {/* XP Progress Bar */}
           <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-1 relative border border-gray-700">
              <div className="bg-yellow-500 h-full transition-all duration-1000" style={{ width: `${progressToNextRank}%` }}></div>
           </div>
           <div className="flex justify-between w-full text-[10px] text-gray-500 uppercase font-bold tracking-wider">
               <span>{currentRank.name}</span>
               <span className="text-yellow-500">{Math.floor(totalXP)} XP</span>
               <span>{nextRank ? nextRank.name : "MAX"}</span>
           </div>
        </div>

        <div className="flex items-center justify-between w-full mb-4">
          <button disabled={currentIdx === 0} onClick={() => { playClick(); setCurrentIdx(p => p - 1) }} className={`text-2xl p-2 transition ${currentIdx === 0 ? 'text-gray-700' : 'text-white hover:scale-110'}`}><FaChevronLeft /></button>
          <div className="flex flex-col items-center">
             <h2 className="text-2xl font-bold">{currentExercise.name}</h2>
             <span className="text-xs text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-900/50">
                {currentExercise.xpPerRep || 1} XP за раз
             </span>
          </div>
          <button disabled={currentIdx === exercises.length - 1} onClick={() => { playClick(); setCurrentIdx(p => p + 1) }} className={`text-2xl p-2 transition ${currentIdx === exercises.length - 1 ? 'text-gray-700' : 'text-white hover:scale-110'}`}><FaChevronRight /></button>
        </div>

        <div className="relative flex items-center justify-center mb-8">
          <svg width="300" height="300" className="transform -rotate-90 drop-shadow-2xl">
            <circle cx="150" cy="150" r="120" stroke="#374151" strokeWidth="15" fill="transparent" />
            <circle cx="150" cy="150" r="120" stroke="#3B82F6" strokeWidth="15" fill="transparent" strokeDasharray={2 * Math.PI * 120} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
          </svg>
          
          {/* --- НОВЫЙ ДИЗАЙН ЦЕНТРА --- */}
       {/* --- ЗАМЕНИТЬ ЭТОТ БЛОК ВНУТРИ SVG --- */}
          <div className="absolute flex flex-col items-center justify-center pt-2">
            
            {/* Верхняя строка: 50 / 50 + Карандаш */}
            <div className="flex items-baseline gap-1">
                <span className="text-6xl font-bold text-white tracking-tighter leading-none">
                  {currentExercise.count}
                </span>
                <span className="text-3xl text-gray-500 font-semibold">
                  <span className="mx-1">/</span>{currentExercise.target}
                </span>
                
                {/* Кнопка редактирования */}
                <button 
                    onClick={() => { 
                        playClick(); 
                        const t = prompt("Цель:", exercises[currentIdx].target); 
                        if (t) { 
                            const u = [...exercises]; 
                            u[currentIdx].target = parseInt(t); 
                            setExercises(u); 
                            updateDoc(doc(db, 'users', user.uid), { exercises: u }); 
                        } 
                    }} 
                    className="ml-2 text-sm text-gray-600 hover:text-white transition -translate-y-1"
                >
                    <FaPen />
                </button>
            </div>

            {/* Нижняя строка: Единица измерения (РАЗ, СЕК, КГ) */}
            <span className="text-sm text-blue-400 font-bold uppercase tracking-[0.2em] mt-2">
                {currentExercise.unit || 'раз'}
            </span>

            {/* Поле ввода */}
            <div className="flex items-center space-x-2 mt-6">
              <input type="number" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="+0" className="w-20 bg-gray-800 text-center text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
              <button onClick={() => inputValue && updateProgress(inputValue)} className="bg-blue-600 p-3 rounded-xl font-bold hover:bg-blue-500 shadow-lg active:scale-95 transition">OK</button>
            </div>
          </div>
		  </div>
          {/* --- КОНЕЦ БЛОКА --- */}
        {/* УМНЫЕ КНОПКИ */}
        <div className="flex gap-4">
          {getQuickButtons().map(n => (
             <button key={n} onClick={() => updateProgress(n)} className="px-6 py-3 bg-gray-800 rounded-2xl text-lg font-bold hover:bg-gray-700 active:scale-95 transition shadow-lg border border-gray-700">
               +{n}
             </button>
          ))}
        </div>
      </main>

      <AnimatePresence>
        {/* SOCIAL MODAL */}
        {showSocial && (
          <Modal onClose={() => setShowSocial(false)} title="Зал Славы">
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[70vh] custom-scrollbar pr-1">
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-yellow-400 flex items-center gap-2"><FaTrophy /> Топ-10</h4>
                    <select value={selectedLeaderboardExercise} onChange={(e) => { playClick(); setSelectedLeaderboardExercise(e.target.value); fetchLeaderboard(e.target.value); }} className="bg-gray-700 text-white text-xs p-1 rounded outline-none border border-gray-600">
                        {exercises.map(ex => (<option key={ex.name} value={ex.name}>{ex.name}</option>))}
                    </select>
                </div>
                <div className="bg-gray-700/30 rounded-lg overflow-hidden border border-gray-600">
                  {leaderboard.length === 0 ? <div className="p-4 text-center text-sm text-gray-400"><p>Нет данных</p></div> : 
                    leaderboard.map((u, i) => (
                      <div key={u.id} className={`flex justify-between items-center p-3 border-b border-gray-600/50 ${u.userId === user.uid ? 'bg-blue-900/30' : ''}`}>
                        <div className="flex items-center gap-3"><span className={`font-bold w-6 text-center ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>#{i + 1}</span><div className="flex flex-col"><span className="text-sm font-bold">{u.displayName}</span><span className="text-xs text-gray-400">{u.exercise}</span></div></div><span className="font-bold text-blue-400">{u.count}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
              <div>
                <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2"><FaUserFriends /> Друзья</h4>
                <div className="flex gap-2 mb-4"><input value={friendEmailInput} onChange={e=>setFriendEmailInput(e.target.value)} placeholder="Email друга" className="bg-gray-700 p-2 rounded text-sm w-full outline-none"/><button onClick={()=>{playClick();addFriend()}} className="bg-blue-600 p-2 rounded text-white"><FaSearch/></button></div>
                {friendSearchStatus && <p className="text-xs text-gray-400 mb-2">{friendSearchStatus}</p>}
                <div className="flex flex-col gap-2">{friendsList.map((f,i)=><div key={i} className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center"><div><p className="font-bold text-sm">{f.displayName}</p><p className="text-xs text-gray-400">{f.email}</p></div><div className="text-right"><p className="font-bold text-white text-xs bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-900/50 mb-1">{f.totalXP ? Math.floor(f.totalXP) : 0} XP</p><p className="text-xs text-green-400">Сегодня: {f.exercises?f.exercises.reduce((a,c)=>a+(c.count||0),0):0}</p></div></div>)}</div>
              </div>
            </div>
          </Modal>
        )}

        {/* STATS MODAL */}
        {showStats && (
          <Modal onClose={() => setShowStats(false)} title="Статистика">
            <div className="flex flex-col gap-6 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
              <div className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center"><span className="text-sm text-gray-300">Упражнение:</span><select value={selectedStatsExercise} onChange={(e) => { playClick(); setSelectedStatsExercise(e.target.value); }} className="bg-gray-800 text-white text-sm p-2 rounded outline-none border border-gray-600">{exercises.map(ex => (<option key={ex.name} value={ex.name}>{ex.name}</option>))}</select></div>
              <div className="bg-gray-700/30 p-4 rounded-xl border border-gray-600">
                <div className="flex justify-between items-end mb-2"><div><span className="text-xs text-gray-400 uppercase">Ранг (FitPoints)</span><div className="text-2xl font-bold text-yellow-400 flex items-center gap-2"><FaTrophy /> {getCurrentRank(totalXP).name}</div></div><div className="text-right"><span className="text-xl font-bold">{Math.floor(totalXP)}</span><span className="text-xs text-gray-500 block">XP всего</span></div></div>
              </div>
              <div><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-gray-300">График</h4><div className="flex gap-1 text-xs bg-gray-700 rounded p-1"><button onClick={() => setStatsRange('week')} className={`px-2 py-1 rounded ${statsRange === 'week' ? 'bg-blue-600' : ''}`}>7 дн</button><button onClick={() => setStatsRange('month')} className={`px-2 py-1 rounded ${statsRange === 'month' ? 'bg-blue-600' : ''}`}>30 дн</button></div></div><div className="h-48 w-full bg-gray-800/50 rounded-lg p-2"><ResponsiveContainer width="100%" height="100%"><BarChart data={getChartData()}><CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} /><XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 10 }} /><YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} cursor={{ fill: '#374151', opacity: 0.4 }} /><Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
              <div><h4 className="font-bold text-gray-300 mb-2">Общая активность (Год)</h4><div className="bg-gray-800/50 p-2 rounded-lg overflow-x-auto"><div className="min-w-[500px]"><CalendarHeatmap startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))} endDate={new Date()} values={getHeatmapData()} classForValue={(value) => { if (!value || value.count === 0) return 'color-empty'; if (value.count < 20) return 'color-scale-1'; if (value.count < 50) return 'color-scale-2'; if (value.count < 100) return 'color-scale-3'; return 'color-scale-4'; }} showWeekdayLabels={true} /></div></div></div>
            </div>
          </Modal>
        )}

        {/* ADD EXERCISE MODAL */}
        {showAddModal && (
          <Modal onClose={() => setShowAddModal(false)} title="Новое упражнение">
            <form onSubmit={handleAddExercise} className="flex flex-col gap-4">
              <input name="name" placeholder="Название (напр. Планка)" className="bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-blue-500" required />
              <div className="flex gap-2">
                 <input name="target" type="number" placeholder="Цель" className="bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-blue-500 w-1/3" required />
                 
                 {/* ВЫБОР ЕДИНИЦ */}
                 <select name="unit" className="bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-blue-500 w-1/3">
                    <option value="раз">раз</option>
                    <option value="сек">сек</option>
                    <option value="мин">мин</option>
                    <option value="км">км</option>
                    <option value="кг">кг</option>
                 </select>

                 <input name="xp" type="number" step="0.1" placeholder="XP" defaultValue="1" className="bg-gray-700 p-3 rounded text-white outline-none focus:ring-2 focus:ring-blue-500 w-1/3" required />
              </div>
              <p className="text-xs text-gray-400">Совет: 1 отжимание = 1 XP, 1 мин планки = 5 XP</p>
              <button className="bg-blue-600 py-3 rounded font-bold hover:bg-blue-500 shadow-md">Добавить</button>
            </form>
          </Modal>
        )}
        
        {/* SETTINGS */}
        {showSettings && (
          <Modal onClose={() => setShowSettings(false)} title="Настройки">
            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              <button onClick={() => { playClick(); if (window.confirm("Обновить?")) { const b = writeBatch(db); INITIAL_QUOTES_DB.forEach(q => b.set(doc(collection(db, "quotes")), q)); b.commit(); window.location.reload(); } }} className="flex justify-between items-center bg-gray-700 p-3 rounded hover:bg-gray-600"><span className="text-sm">Сброс цитат</span><FaCloudUploadAlt /></button>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700"><span className="font-bold">Уведомления</span><input type="checkbox" checked={settings.notify} onChange={e => { playClick(); if (e.target.checked && Notification.permission !== 'granted') Notification.requestPermission(); const s = { ...settings, notify: e.target.checked }; setSettings(s); updateDoc(doc(db, 'users', user.uid), { settings: s }) }} className="w-5 h-5 accent-blue-600" /></div>
              {settings.notify && (<div className="bg-gray-700/50 p-3 rounded flex flex-col gap-2">{settings.times.map((t, i) => <div key={i} className="flex gap-2"><input type="time" value={t} onChange={e => { const n = [...settings.times]; n[i] = e.target.value; const s = { ...settings, times: n }; setSettings(s); updateDoc(doc(db, 'users', user.uid), { settings: s }) }} className="bg-gray-700 p-1 rounded text-white w-full" /></div>)}<button onClick={() => { playClick(); const s = { ...settings, times: [...settings.times, '12:00'] }; setSettings(s); updateDoc(doc(db, 'users', user.uid), { settings: s }) }} className="text-blue-400 text-xs flex items-center gap-1 mt-1"><FaPlus /> Добавить время</button></div>)}
              <div className="flex flex-col gap-2"><span className="text-sm text-gray-400">Дни</span><div className="flex justify-between text-xs">{DAYS_OF_WEEK.map(d => <button key={d} onClick={() => { playClick(); const n = settings.days.includes(d) ? settings.days.filter(x => x !== d) : [...settings.days, d]; const s = { ...settings, days: n }; setSettings(s); updateDoc(doc(db, 'users', user.uid), { settings: s }) }} className={`w-8 h-8 rounded-full ${settings.days.includes(d) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{d}</button>)}</div></div>
              <button onClick={() => { playClick(); logout() }} className="mt-4 flex justify-center gap-2 text-red-400 border border-red-900/30 rounded py-2 bg-red-900/10"><FaSignOutAlt /> Выйти</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

const Modal = ({ onClose, title, children }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-gray-800 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      {children}
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
    </motion.div>
  </motion.div>
);

export default App;