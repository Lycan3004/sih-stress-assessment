import { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, ShieldAlert, Users } from 'lucide-react';

export default function Dashboard() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAssessments = async () => {
      const user = auth.currentUser;
      if (!user) return; 
      try {
        const token = await user.getIdToken();
        const response = await axios.get('http://localhost:4000/api/assessments', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAssessments(response.data);
      } catch (error) {
        console.error("Failed to fetch assessments", error);
      }
    };
    
    setTimeout(fetchAssessments, 1000);

    const socket = io('http://localhost:4000');
    socket.on('new_assessment', (newAssessment) => {
      setAssessments((prev) => [newAssessment, ...prev]);
    });

    return () => { socket.disconnect(); };
  }, []);

  // Prepare data for the graphs
  const riskCounts = assessments.reduce((acc, curr) => {
    acc[curr.riskLevel] = (acc[curr.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const graphData = [
    { name: 'CRITICAL', count: riskCounts['CRITICAL'] || 0, color: '#ef4444' }, // red-500
    { name: 'HIGH', count: riskCounts['HIGH'] || 0, color: '#f97316' },      // orange-500
    { name: 'MODERATE', count: riskCounts['MODERATE'] || 0, color: '#eab308' }, // yellow-500
    { name: 'LOW', count: riskCounts['LOW'] || 0, color: '#22c55e' },         // green-500
  ];

  const criticalCount = graphData[0].count;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-10 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-blue-500 w-8 h-8" />
            <h1 className="text-2xl font-bold tracking-wider text-slate-100">COMMAND CENTER</h1>
          </div>
          <button 
            onClick={() => navigate('/assessment')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors shadow-lg border border-blue-500"
          >
            Switch to Victim UI
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl flex items-center gap-4">
            <div className="p-4 bg-blue-900/30 rounded-lg text-blue-500"><Users className="w-8 h-8"/></div>
            <div>
              <p className="text-slate-400 text-sm font-semibold tracking-wide">TOTAL CASES</p>
              <h2 className="text-3xl font-bold text-slate-100">{assessments.length}</h2>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-red-900/50 rounded-xl p-6 shadow-2xl flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl"></div>
            <div className="p-4 bg-red-900/30 rounded-lg text-red-500"><Activity className="w-8 h-8 animate-pulse"/></div>
            <div>
              <p className="text-red-400 text-sm font-semibold tracking-wide">CRITICAL ALERTS</p>
              <h2 className="text-3xl font-bold text-slate-100">{criticalCount}</h2>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Graph */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-300 mb-6 tracking-wide">RISK DISTRIBUTION</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}} 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {graphData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Live Feed Table */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col h-full">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-300 tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                LIVE INCIDENT FEED
              </h3>
            </div>
            
            <div className="overflow-y-auto p-0 flex-1 max-h-[400px]">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-900/50 sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User / Time</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Transcript</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">SVI Score</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {assessments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-200">{a.user?.email}</div>
                        <div className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-400 line-clamp-2 max-w-sm italic">"{a.textInput}"</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold font-mono text-slate-300">{a.sviScore}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-md uppercase tracking-wider shadow-sm border
                          ${a.riskLevel === 'CRITICAL' ? 'bg-red-900/30 text-red-400 border-red-800/50' : 
                            a.riskLevel === 'HIGH' ? 'bg-orange-900/30 text-orange-400 border-orange-800/50' : 
                            'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'}`}>
                          {a.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
