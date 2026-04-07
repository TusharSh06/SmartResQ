import React, { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const Profile = () => {
  const [profile, setProfile] = useState({
    username: '',
    first_name: '',
    last_name: '',
    age: '',
    profile_pic: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [previewPic, setPreviewPic] = useState(null);

  // Cropper states
  const [imageToCrop, setImageToCrop] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProfile({
          username: data.username || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          age: data.age || '',
          profile_pic: data.profile_pic || null
        });
        setPreviewPic(data.profile_pic || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    try {
      const croppedImageBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setProfile({ ...profile, profile_pic_base64: croppedImageBase64 });
      setPreviewPic(croppedImageBase64);
      setIsCropping(false);
      setImageToCrop(null);
    } catch (e) {
      console.error(e);
      alert('Failed to crop image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ text: 'Profile updated successfully!', type: 'success' });
        if (data.profile_pic) {
          setProfile(prev => ({ ...prev, profile_pic: data.profile_pic }));
          setPreviewPic(data.profile_pic);
        }
      } else {
        setMessage({ text: data.error || 'Failed to update profile.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>Loading profile...</div>;

  const inputStyle = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
    background: '#ffffff', border: '1px solid #E2E8F0',
    color: '#0F172A', outline: 'none', fontSize: '0.95rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
  };

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '800px' }}>
      
      {isCropping && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', 
          background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', height: '400px', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              onClick={() => setIsCropping(false)}
              style={{
                padding: '0.75rem 2rem', borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.1)', color: 'white', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer'
              }}
            >Cancel</button>
            <button 
              onClick={handleSaveCrop}
              style={{
                padding: '0.75rem 2rem', borderRadius: '8px',
                background: '#2563EB', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.4)'
              }}
            >Apply Crop</button>
          </div>
        </div>
      )}

      <div className="view-title">
        <h2>My Profile</h2>
        <div className="view-subtitle">Manage your personal information and preferences</div>
      </div>

      <div style={{
        marginTop: '2rem',
        background: '#ffffff',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%', background: '#F8FAFC',
                border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', backgroundImage: previewPic ? `url(${previewPic})` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center'
              }}>
                {!previewPic && <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600 }}>No Image</span>}
              </div>
              <label style={{
                position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                background: '#2563EB', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '100px',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
                whiteSpace: 'nowrap'
              }}>
                Upload Pic
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              </label>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '1.2rem' }}>
                {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.username}
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>{profile.username}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>First Name</label>
              <input 
                type="text" value={profile.first_name}
                onChange={e => setProfile({...profile, first_name: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Last Name</label>
              <input 
                type="text" value={profile.last_name}
                onChange={e => setProfile({...profile, last_name: e.target.value})}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Age</label>
              <input 
                type="number" value={profile.age} min="16"
                onChange={e => setProfile({...profile, age: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Email Address (Read Only)</label>
              <input 
                type="text" value={profile.username} disabled
                style={{...inputStyle, background: '#F8FAFC', color: '#94A3B8', cursor: 'not-allowed'}}
              />
            </div>
          </div>

          {message.text && (
            <div style={{
              padding: '0.8rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500,
              background: message.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              color: message.type === 'success' ? '#16A34A' : '#DC2626',
              border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
            }}>
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button 
              type="submit" disabled={isSaving}
              style={{
                padding: '0.75rem 2rem', borderRadius: '8px',
                background: '#2563EB', color: 'white', fontWeight: 600, 
                border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)', transition: 'all 0.2s'
              }}
            >
              {isSaving ? 'Saving...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
