import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Eye,
  Edit,
  Edit2,
  Edit3,
  Trash2,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  Crown,
  ArrowRightLeft,
  X,
  Palette,
  Check,
} from 'lucide-react';
import { MemberRole, Household, HouseholdMember } from '../../lib/types';
import { formatDate } from '../../lib/i18n';
import {
  HOUSEHOLD_ICONS,
  HOUSEHOLD_COLORS,
  renderHouseholdIcon,
} from '../../lib/householdIcons';

export const HouseholdUsersScreen: React.FC = () => {
  const {
    user,
    activeHousehold,
    households,
    allSystemHouseholds,
    householdMembers,
    isSuperUser,
    currentRole,
    canManageUsers,
    fetchHouseholdMembers,
    addHouseholdMember,
    updateMemberRole,
    removeHouseholdMember,
    createHouseholdAsSuperUser,
    updateHousehold,
    switchHousehold,
    language,
  } = useAuth();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddHhModalOpen, setIsAddHhModalOpen] = useState(false);
  const [isEditHhModalOpen, setIsEditHhModalOpen] = useState(false);

  // Edit Household form state
  const [editingHh, setEditingHh] = useState<Household | null>(null);
  const [editHhName, setEditHhName] = useState('');
  const [editHhIcon, setEditHhIcon] = useState('Home');
  const [editHhColor, setEditHhColor] = useState('#4F46E5');
  const [editHhCurrency, setEditHhCurrency] = useState('ILS');

  // Add Member form states
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('user');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Household form state (Super User)
  const [newHhName, setNewHhName] = useState('');
  const [newHhCurrency, setNewHhCurrency] = useState('ILS');
  const [newHhIcon, setNewHhIcon] = useState('Home');
  const [newHhColor, setNewHhColor] = useState('#4F46E5');

  useEffect(() => {
    if (activeHousehold) {
      fetchHouseholdMembers(activeHousehold.id);
    }
  }, [activeHousehold?.id]);

  const handleOpenEditModal = (hh: Household) => {
    setEditingHh(hh);
    setEditHhName(hh.name);
    setEditHhIcon(hh.icon || 'Home');
    setEditHhColor(hh.color || '#4F46E5');
    setEditHhCurrency(hh.currency || 'ILS');
    setIsEditHhModalOpen(true);
  };

  const handleSaveHouseholdEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHh || !editHhName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await updateHousehold(editingHh.id, {
        name: editHhName.trim(),
        icon: editHhIcon,
        color: editHhColor,
        currency: editHhCurrency,
      });
      if (res.success) {
        setIsEditHhModalOpen(false);
        setEditingHh(null);
      } else {
        alert(res.error || 'Error saving changes');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update household');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!activeHousehold) {
      setFormError(language === 'he' ? 'לא נבחר משק בית פעיל' : 'No active household selected');
      return;
    }

    if (!newEmail.trim() || !newEmail.includes('@')) {
      setFormError(language === 'he' ? 'אנא הזן כתובת אימייל תקינה' : 'Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addHouseholdMember(
        activeHousehold.id,
        newEmail.trim(),
        newRole,
        newName.trim() || undefined
      );

      if (res.success) {
        setFormSuccess(
          language === 'he'
            ? `המשתמש ${newEmail} נוסף בהצלחה למשק הבית עם הרשאת ${getRoleLabel(newRole)}!`
            : `User ${newEmail} added successfully with role ${newRole}!`
        );
        setNewEmail('');
        setNewName('');
        setNewRole('user');
        setTimeout(() => {
          setIsAddModalOpen(false);
          setFormSuccess(null);
        }, 2000);
      } else {
        setFormError(res.error || (language === 'he' ? 'שגיאה בהוספת המשתמש' : 'Error adding user'));
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (member: HouseholdMember, newR: MemberRole) => {
    if (member.email?.toLowerCase() === user?.email?.toLowerCase() && !isSuperUser) {
      alert(language === 'he' ? 'אינך יכול לשנות את ההרשאה של עצמך' : 'You cannot change your own role');
      return;
    }

    const confirmMsg =
      language === 'he'
        ? `האם לשנות את תפקיד ${member.full_name || member.email} ל-${getRoleLabel(newR)}?`
        : `Change role of ${member.full_name || member.email} to ${newR}?`;

    if (confirm(confirmMsg)) {
      await updateMemberRole(member.id, newR);
    }
  };

  const handleRemoveMember = async (member: HouseholdMember) => {
    if (member.email?.toLowerCase() === user?.email?.toLowerCase() && !isSuperUser) {
      alert(language === 'he' ? 'אינך יכול להסיר את עצמך ממשק הבית' : 'You cannot remove yourself');
      return;
    }

    const confirmMsg =
      language === 'he'
        ? `האם אתה בטוח שברצונך להסיר את ${member.full_name || member.email} ממשק הבית?`
        : `Are you sure you want to remove ${member.full_name || member.email} from this household?`;

    if (confirm(confirmMsg)) {
      await removeHouseholdMember(member.id);
    }
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHhName.trim()) return;

    await createHouseholdAsSuperUser(newHhName.trim(), newHhCurrency, newHhIcon, newHhColor);
    setNewHhName('');
    setNewHhIcon('Home');
    setNewHhColor('#4F46E5');
    setIsAddHhModalOpen(false);
  };

  const getRoleLabel = (r: MemberRole | string) => {
    if (language === 'he') {
      switch (r) {
        case 'super_admin':
          return 'מנהל על (Super User)';
        case 'owner':
        case 'admin':
          return 'מנהל (Admin)';
        case 'user':
        case 'member':
          return 'עורך (User)';
        case 'viewer':
          return 'צופה (Viewer)';
        default:
          return r;
      }
    }
    switch (r) {
      case 'super_admin':
        return 'Super User';
      case 'owner':
      case 'admin':
        return 'Admin';
      case 'user':
      case 'member':
        return 'User (Editor)';
      case 'viewer':
        return 'Viewer';
      default:
        return r;
    }
  };

  const getRoleBadgeStyle = (r: MemberRole | string) => {
    switch (r) {
      case 'super_admin':
        return {
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          color: '#7C3AED',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        };
      case 'owner':
      case 'admin':
        return {
          backgroundColor: 'rgba(79, 70, 229, 0.12)',
          color: 'var(--primary)',
          border: '1px solid rgba(79, 70, 229, 0.3)',
        };
      case 'user':
      case 'member':
        return {
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          color: '#0284C7',
          border: '1px solid rgba(2, 132, 199, 0.3)',
        };
      case 'viewer':
      default:
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          color: '#D97706',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        };
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={styles.headerIconBox}>
              <Users size={24} color="var(--primary)" />
            </div>
            <div>
              <h1 style={styles.pageTitle}>
                {language === 'he' ? 'משתמשים והרשאות משק בית' : 'Household Users & Permissions'}
              </h1>
              <p style={styles.pageSub}>
                {language === 'he'
                  ? `ניהול חברי משק הבית והגדרת הרשאות גישה`
                  : `Manage members and roles for your household`}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canManageUsers && (
            <button style={styles.addMemberBtn} onClick={() => setIsAddModalOpen(true)}>
              <UserPlus size={16} />
              <span>{language === 'he' ? '+ הוסף משתמש למשק הבית' : '+ Add Household Member'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Household Summary & Customization Banner */}
      {activeHousehold && (
        <div style={styles.activeHhBanner} className="animate-fade-in">
          <div style={styles.activeHhLeft}>
            <div
              style={{
                ...styles.activeHhIconBox,
                backgroundColor: `${activeHousehold.color || 'var(--primary)'}18`,
                borderColor: `${activeHousehold.color || 'var(--primary)'}40`,
                color: activeHousehold.color || 'var(--primary)',
              }}
            >
              {renderHouseholdIcon(activeHousehold.icon, 24, activeHousehold.color || 'var(--primary)')}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={styles.activeHhName}>{activeHousehold.name}</h2>
                <span style={styles.currencyBadge}>{activeHousehold.currency || 'ILS'}</span>
                <span style={styles.activePill}>
                  ✓ {language === 'he' ? 'משק בית פעיל' : 'Active Household'}
                </span>
              </div>
              <div style={styles.activeHhMeta}>
                <span>
                  {language === 'he' ? 'נוצר בתאריך:' : 'Created:'} {formatDate(activeHousehold.created_at)}
                </span>
                <span>•</span>
                <span>
                  {householdMembers.length} {language === 'he' ? 'חברים רשומים' : 'members'}
                </span>
              </div>
            </div>
          </div>

          {canManageUsers && (
            <button
              style={styles.editHhBtn}
              onClick={() => handleOpenEditModal(activeHousehold)}
              title={language === 'he' ? 'ערוך שם ואייקון משק בית' : 'Edit name & icon'}
            >
              <Edit3 size={15} color="var(--primary)" />
              <span>{language === 'he' ? 'ערוך שם ואייקון' : 'Edit Name & Icon'}</span>
            </button>
          )}
        </div>
      )}

      {/* Super User Banner (If logged in as Super User) */}
      {isSuperUser && (
        <div style={styles.superUserBanner} className="animate-fade-in">
          <div style={styles.superBannerLeft}>
            <div style={styles.crownIconWrap}>
              <Crown size={22} color="#F59E0B" />
            </div>
            <div>
              <div style={styles.superTitle}>
                {language === 'he'
                  ? '👑 מחובר כמנהל על (Super User)'
                  : '👑 Logged in as Super User'}
                <span style={styles.superEmailBadge}>{user?.email}</span>
              </div>
              <div style={styles.superSub}>
                {language === 'he'
                  ? 'לך הרשאה מלאה לצפות ולעבור בין כל משקי הבית במערכת, ליצור משקי בית חדשים ולשנות שמות ואייקונים.'
                  : 'You have full global access to switch between all households, add new households, and manage names/icons.'}
              </div>
            </div>
          </div>
          <button style={styles.createHhBtn} onClick={() => setIsAddHhModalOpen(true)}>
            <Plus size={16} />
            <span>{language === 'he' ? 'צור משק בית חדש' : 'Create New Household'}</span>
          </button>
        </div>
      )}

      {/* Role Definitions Guidance Card */}
      <div style={styles.rolesGrid}>
        <div style={styles.roleCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ ...styles.roleIconWrap, backgroundColor: 'rgba(79, 70, 229, 0.12)' }}>
              <ShieldCheck size={18} color="var(--primary)" />
            </div>
            <strong style={styles.roleCardTitle}>
              {language === 'he' ? 'מנהל (Admin)' : 'Admin'}
            </strong>
          </div>
          <p style={styles.roleCardDesc}>
            {language === 'he'
              ? 'גישה מלאה: עריכת שם ואייקון משק הבית, הוספת חברים, עריכת ומחיקת תנועות, ייבוא קבצים והגדרות.'
              : 'Full access: edit household name/icon, manage members, add/edit/delete records, import files.'}
          </p>
        </div>

        <div style={styles.roleCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ ...styles.roleIconWrap, backgroundColor: 'rgba(2, 132, 199, 0.12)' }}>
              <Edit size={18} color="#0284C7" />
            </div>
            <strong style={styles.roleCardTitle}>
              {language === 'he' ? 'עורך (User)' : 'User (Editor)'}
            </strong>
          </div>
          <p style={styles.roleCardDesc}>
            {language === 'he'
              ? 'יכול להזין ולערוך תנועות ורשומות. אין אפשרות לייבא קבצים, למחוק/להסתיר תנועות או לנהל משתמשים.'
              : 'Can view, enter and edit records. Cannot import files, delete/soft-delete, or manage members.'}
          </p>
        </div>

        <div style={styles.roleCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ ...styles.roleIconWrap, backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
              <Eye size={18} color="#D97706" />
            </div>
            <strong style={styles.roleCardTitle}>
              {language === 'he' ? 'צופה (Viewer)' : 'Viewer'}
            </strong>
          </div>
          <p style={styles.roleCardDesc}>
            {language === 'he'
              ? 'צפייה בלבד (Read-Only) בכל הדוחות, התנועות, התקציבים והחיסכון. ללא הרשאת עריכה או הוספה.'
              : 'Read-only access to all dashboards, ledgers, and transactions. Cannot edit or add any records.'}
          </p>
        </div>
      </div>

      {/* Household Members Table Card */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={18} color="var(--primary)" />
            <span style={styles.tableTitle}>
              {language === 'he' ? `חברי משק הבית: ${activeHousehold?.name || ''}` : `Members of: ${activeHousehold?.name || ''}`}
            </span>
            <span style={styles.countBadge}>{householdMembers.length}</span>
          </div>
          <div style={styles.currentRoleIndicator}>
            {language === 'he' ? 'ההרשאה שלך במשק בית זה:' : 'Your Role in this household:'}{' '}
            <span style={{ ...styles.roleBadge, ...getRoleBadgeStyle(currentRole) }}>
              {getRoleLabel(currentRole)}
            </span>
          </div>
        </div>

        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{language === 'he' ? 'שם ומשתמש' : 'Member Name'}</th>
                <th style={styles.th}>{language === 'he' ? 'כתובת אימייל' : 'Email Address'}</th>
                <th style={styles.th}>{language === 'he' ? 'תפקיד והרשאה' : 'Role & Permissions'}</th>
                <th style={styles.th}>{language === 'he' ? 'תאריך הצטרפות' : 'Joined Date'}</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>
                  {language === 'he' ? 'פעולות' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {householdMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={styles.emptyTd}>
                    {language === 'he' ? 'לא נמצאו חברים במשק הבית' : 'No members found in this household'}
                  </td>
                </tr>
              ) : (
                householdMembers.map((member) => {
                  const isCurrentLoggedUser =
                    member.email?.toLowerCase() === user?.email?.toLowerCase();

                  return (
                    <tr key={member.id} style={styles.tr}>
                      {/* Name & Avatar */}
                      <td style={styles.td}>
                        <div style={styles.memberCell}>
                          <div style={styles.memberAvatar}>
                            {(member.full_name || member.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={styles.memberName}>
                              {member.full_name || member.email?.split('@')[0] || 'User'}
                              {isCurrentLoggedUser && (
                                <span style={styles.youBadge}>
                                  {language === 'he' ? ' (אתה)' : ' (You)'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={styles.td}>
                        <div style={styles.emailCell}>
                          <Mail size={13} color="var(--text-muted)" />
                          <span>{member.email || '—'}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={styles.td}>
                        {canManageUsers && !isCurrentLoggedUser ? (
                          <select
                            style={styles.roleSelect}
                            value={member.role}
                            onChange={(e) => handleRoleChange(member, e.target.value as MemberRole)}
                          >
                            <option value="admin">🛡️ {getRoleLabel('admin')}</option>
                            <option value="user">✏️ {getRoleLabel('user')}</option>
                            <option value="viewer">👁️ {getRoleLabel('viewer')}</option>
                          </select>
                        ) : (
                          <span style={{ ...styles.roleBadge, ...getRoleBadgeStyle(member.role) }}>
                            {getRoleLabel(member.role)}
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Clock size={13} />
                          <span>{formatDate(member.joined_at)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        {canManageUsers && !isCurrentLoggedUser ? (
                          <button
                            style={styles.deleteBtn}
                            onClick={() => handleRemoveMember(member)}
                            title={language === 'he' ? 'הסר משתמש ממשק הבית' : 'Remove user'}
                          >
                            <Trash2 size={15} color="var(--danger)" />
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super User Global Households Hub */}
      {isSuperUser && (
        <div style={styles.superHubCard}>
          <div style={styles.superHubHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={styles.superIconWrap}>
                <Sparkles size={18} color="#7C3AED" />
              </div>
              <div>
                <h3 style={styles.superHubTitle}>
                  {language === 'he' ? 'כל משקי הבית במערכת (Super User Hub)' : 'All System Households (Super User Hub)'}
                </h3>
                <p style={styles.superHubSub}>
                  {language === 'he'
                    ? 'מעבר ועריכת שמות ואייקונים של כלל משקי הבית הרשומים במסד הנתונים'
                    : 'Switch and customize name & icon for any household in the system'}
                </p>
              </div>
            </div>
            <span style={styles.hhCountBadge}>
              {allSystemHouseholds.length || households.length}{' '}
              {language === 'he' ? 'משקי בית' : 'households'}
            </span>
          </div>

          <div style={styles.householdsGrid}>
            {(allSystemHouseholds.length > 0 ? allSystemHouseholds : households).map((hh) => {
              const isActive = activeHousehold?.id === hh.id;
              const hhColor = hh.color || '#4F46E5';

              return (
                <div
                  key={hh.id}
                  style={{
                    ...styles.hhCard,
                    ...(isActive ? styles.hhCardActive : {}),
                    borderTop: `3px solid ${hhColor}`,
                  }}
                >
                  <div style={styles.hhCardTop}>
                    <div
                      style={{
                        ...styles.hhCardIconWrap,
                        backgroundColor: `${hhColor}15`,
                        borderColor: `${hhColor}35`,
                        color: hhColor,
                      }}
                    >
                      {renderHouseholdIcon(hh.icon, 20, hhColor)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.hhCardName}>{hh.name}</div>
                      <div style={styles.hhCardMeta}>
                        {hh.currency} • {formatDate(hh.created_at)}
                      </div>
                    </div>

                    {/* Edit Household Button on Card */}
                    <button
                      style={styles.cardEditBtn}
                      onClick={() => handleOpenEditModal(hh)}
                      title={language === 'he' ? 'ערוך שם ואייקון' : 'Edit name & icon'}
                    >
                      <Edit2 size={13} color="var(--text-secondary)" />
                    </button>
                  </div>

                  <div style={styles.hhCardBottom}>
                    {isActive ? (
                      <span style={styles.activeHhTag}>
                        ✓ {language === 'he' ? 'משק בית נוכחי' : 'Current Active'}
                      </span>
                    ) : (
                      <button
                        style={styles.switchHhBtn}
                        onClick={() => switchHousehold(hh.id)}
                      >
                        <ArrowRightLeft size={14} />
                        <span>{language === 'he' ? 'עבור למשק בית זה' : 'Switch Household'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal 1: Add User to Household */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--primary)" />
                <h3 style={styles.modalTitle}>
                  {language === 'he' ? 'הוספת משתמש למשק הבית' : 'Add User to Household'}
                </h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              {formError && (
                <div style={styles.errorBanner}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div style={styles.successBanner}>
                  <CheckCircle2 size={16} />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'כתובת אימייל של המשתמש *' : 'User Email Address *'}
                </label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'שם מלא / כינוי (אופציונלי)' : 'Full Name / Nickname (Optional)'}
                </label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="לדוגמה: דנה לוי"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'בחר רמת הרשאה (תפקיד) *' : 'Select User Role *'}
                </label>
                <div style={styles.roleOptionsGrid}>
                  {/* Admin Option */}
                  <label
                    style={{
                      ...styles.roleOptionCard,
                      ...(newRole === 'admin' ? styles.roleOptionCardActive : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={newRole === 'admin'}
                      onChange={() => setNewRole('admin')}
                      style={{ display: 'none' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={16} color="var(--primary)" />
                      <strong>{language === 'he' ? 'מנהל (Admin)' : 'Admin'}</strong>
                    </div>
                    <span style={styles.roleOptionSub}>
                      {language === 'he' ? 'גישה מלאה כולל עריכת שם משק בית וניהול משתמשים' : 'Full access & management'}
                    </span>
                  </label>

                  {/* User Option */}
                  <label
                    style={{
                      ...styles.roleOptionCard,
                      ...(newRole === 'user' ? styles.roleOptionCardActive : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={newRole === 'user'}
                      onChange={() => setNewRole('user')}
                      style={{ display: 'none' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Edit size={16} color="#0284C7" />
                      <strong>{language === 'he' ? 'עורך (User)' : 'User (Editor)'}</strong>
                    </div>
                    <span style={styles.roleOptionSub}>
                      {language === 'he' ? 'הזנה ועריכה (ללא ייבוא/מחיקה)' : 'Can add/edit records only'}
                    </span>
                  </label>

                  {/* Viewer Option */}
                  <label
                    style={{
                      ...styles.roleOptionCard,
                      ...(newRole === 'viewer' ? styles.roleOptionCardActive : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="viewer"
                      checked={newRole === 'viewer'}
                      onChange={() => setNewRole('viewer')}
                      style={{ display: 'none' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Eye size={16} color="#D97706" />
                      <strong>{language === 'he' ? 'צופה (Viewer)' : 'Viewer'}</strong>
                    </div>
                    <span style={styles.roleOptionSub}>
                      {language === 'he' ? 'צפייה בלבד ללא שינויים' : 'Read-only access'}
                    </span>
                  </label>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  style={styles.modalSaveBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? (language === 'he' ? 'מוסיף...' : 'Adding...')
                    : (language === 'he' ? 'הוסף משתמש' : 'Add User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Household Name & Icon */}
      {isEditHhModalOpen && editingHh && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="var(--primary)" />
                <h3 style={styles.modalTitle}>
                  {language === 'he' ? 'עריכת שם ואייקון משק בית' : 'Edit Household Name & Icon'}
                </h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setIsEditHhModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHouseholdEdit}>
              {/* Live Preview Card */}
              <div style={styles.previewBox}>
                <div style={styles.previewLabel}>
                  {language === 'he' ? 'תצוגה מקדימה:' : 'Live Preview:'}
                </div>
                <div style={styles.previewCard}>
                  <div
                    style={{
                      ...styles.previewIconWrap,
                      backgroundColor: `${editHhColor}18`,
                      borderColor: `${editHhColor}40`,
                      color: editHhColor,
                    }}
                  >
                    {renderHouseholdIcon(editHhIcon, 22, editHhColor)}
                  </div>
                  <div>
                    <div style={styles.previewName}>{editHhName || 'שם משק הבית'}</div>
                    <div style={styles.previewMeta}>
                      {editHhCurrency} • {householdMembers.length} {language === 'he' ? 'חברים' : 'members'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Household Display Name Input */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'שם תצוגה של משק הבית *' : 'Household Display Name *'}
                </label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="לדוגמה: בית משפחת כהן"
                  value={editHhName}
                  onChange={(e) => setEditHhName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Currency Selector */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'מטבע ראשי' : 'Main Currency'}
                </label>
                <select
                  style={styles.input}
                  value={editHhCurrency}
                  onChange={(e) => setEditHhCurrency(e.target.value)}
                >
                  <option value="ILS">₪ ILS (שקל חדש)</option>
                  <option value="USD">$ USD (דולר)</option>
                  <option value="EUR">€ EUR (אירו)</option>
                </select>
              </div>

              {/* Color Palette Selector */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'בחר צבע ראשי' : 'Select Theme Color'}
                </label>
                <div style={styles.colorPaletteGrid}>
                  {HOUSEHOLD_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      style={{
                        ...styles.colorCircle,
                        backgroundColor: col,
                        transform: editHhColor === col ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: editHhColor === col ? `0 0 0 3px var(--bg-surface), 0 0 0 5px ${col}` : 'none',
                      }}
                      onClick={() => setEditHhColor(col)}
                    >
                      {editHhColor === col && <Check size={12} color="#FFFFFF" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Picker Grid */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'בחר אייקון למשק הבית' : 'Select Household Icon'}
                </label>
                <div style={styles.iconPickerGrid}>
                  {HOUSEHOLD_ICONS.map((item) => {
                    const isSelected = editHhIcon.toLowerCase() === item.id.toLowerCase();
                    const IconComp = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        style={{
                          ...styles.iconPickerItem,
                          ...(isSelected ? {
                            backgroundColor: `${editHhColor}18`,
                            borderColor: editHhColor,
                            color: editHhColor,
                          } : {}),
                        }}
                        onClick={() => setEditHhIcon(item.id)}
                        title={language === 'he' ? item.nameHe : item.nameEn}
                      >
                        <IconComp size={18} color={isSelected ? editHhColor : 'var(--text-primary)'} />
                        <span style={styles.iconNameText}>
                          {language === 'he' ? item.nameHe : item.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsEditHhModalOpen(false)}
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  style={styles.modalSaveBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? (language === 'he' ? 'שומר...' : 'Saving...')
                    : (language === 'he' ? 'שמור שינויים' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Household (Super User) */}
      {isAddHhModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="#7C3AED" />
                <h3 style={styles.modalTitle}>
                  {language === 'he' ? 'יצירת משק בית חדש במערכת' : 'Create New Household'}
                </h3>
              </div>
              <button style={styles.closeBtn} onClick={() => setIsAddHhModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateHousehold}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'שם משק הבית *' : 'Household Name *'}
                </label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="לדוגמה: דירה להשקעה ירושלים"
                  value={newHhName}
                  onChange={(e) => setNewHhName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'מטבע ראשי' : 'Currency'}
                </label>
                <select
                  style={styles.input}
                  value={newHhCurrency}
                  onChange={(e) => setNewHhCurrency(e.target.value)}
                >
                  <option value="ILS">₪ ILS (שקל חדש)</option>
                  <option value="USD">$ USD (דולר)</option>
                  <option value="EUR">€ EUR (אירו)</option>
                </select>
              </div>

              {/* Color Palette */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'בחר צבע' : 'Select Color'}
                </label>
                <div style={styles.colorPaletteGrid}>
                  {HOUSEHOLD_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      style={{
                        ...styles.colorCircle,
                        backgroundColor: col,
                        transform: newHhColor === col ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: newHhColor === col ? `0 0 0 3px var(--bg-surface), 0 0 0 5px ${col}` : 'none',
                      }}
                      onClick={() => setNewHhColor(col)}
                    >
                      {newHhColor === col && <Check size={12} color="#FFFFFF" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {language === 'he' ? 'בחר אייקון' : 'Select Icon'}
                </label>
                <div style={styles.iconPickerGrid}>
                  {HOUSEHOLD_ICONS.slice(0, 12).map((item) => {
                    const isSelected = newHhIcon.toLowerCase() === item.id.toLowerCase();
                    const IconComp = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        style={{
                          ...styles.iconPickerItem,
                          ...(isSelected ? {
                            backgroundColor: `${newHhColor}18`,
                            borderColor: newHhColor,
                            color: newHhColor,
                          } : {}),
                        }}
                        onClick={() => setNewHhIcon(item.id)}
                      >
                        <IconComp size={18} color={isSelected ? newHhColor : 'var(--text-primary)'} />
                        <span style={styles.iconNameText}>
                          {language === 'he' ? item.nameHe : item.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsAddHhModalOpen(false)}
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button type="submit" style={{ ...styles.modalSaveBtn, backgroundColor: '#7C3AED' }}>
                  {language === 'he' ? 'צור משק בית' : 'Create Household'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerIconBox: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  pageSub: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  addMemberBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.875rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    border: 'none',
  },
  activeHhBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface)',
    border: '1.5px solid var(--border-main)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 22px',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '16px',
  },
  activeHhLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  activeHhIconBox: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeHhName: {
    fontSize: '1.1875rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
  },
  currencyBadge: {
    fontSize: '0.6875rem',
    fontWeight: '800',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-secondary)',
    padding: '2px 8px',
    borderRadius: '8px',
    border: '1px solid var(--border-main)',
  },
  activePill: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--primary)',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  activeHhMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  editHhBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    color: 'var(--primary)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  superUserBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
    border: '1.5px solid rgba(124, 58, 237, 0.3)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  superBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
    minWidth: '280px',
  },
  crownIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  superTitle: {
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: '#7C3AED',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  superEmailBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: '#7C3AED',
    color: '#FFFFFF',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  superSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '3px',
  },
  createHhBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: '#7C3AED',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  roleCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '16px 18px',
    boxShadow: 'var(--shadow-sm)',
  },
  roleIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitle: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  },
  roleCardDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  tableCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-main)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  tableTitle: {
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  countBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid var(--border-main)',
  },
  currentRoleIndicator: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tableResponsive: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'right',
  },
  th: {
    padding: '12px 18px',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-main)',
  },
  tr: {
    borderBottom: '1px solid var(--border-main)',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '14px 18px',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
  },
  emptyTd: {
    textAlign: 'center',
    padding: '36px 20px',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  },
  memberCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  memberAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '800',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  memberName: {
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  youBadge: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--primary)',
    marginLeft: '4px',
  },
  emailCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
  },
  roleBadge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  roleSelect: {
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
  },
  deleteBtn: {
    padding: '6px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--danger-light)',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  superHubCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1.5px solid rgba(124, 58, 237, 0.3)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  superHubHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  superIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  superHubTitle: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#7C3AED',
  },
  superHubSub: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  hhCountBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  householdsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  hhCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '12px',
    transition: 'all 0.15s ease',
  },
  hhCardActive: {
    borderColor: 'var(--primary)',
    backgroundColor: 'rgba(79, 70, 229, 0.04)',
  },
  hhCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  hhCardIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hhCardName: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  hhCardMeta: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  cardEditBtn: {
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hhCardBottom: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  activeHhTag: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  switchHhBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalContent: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
  },
  previewBox: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
  },
  previewLabel: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  previewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  previewIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewName: {
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  previewMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  errorBanner: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--danger-light)',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  successBanner: {
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#065F46',
    fontSize: '0.8125rem',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  colorPaletteGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  iconPickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
    gap: '6px',
    maxHeight: '160px',
    overflowY: 'auto',
    padding: '4px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
  },
  iconPickerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 4px',
    borderRadius: '6px',
    border: '1px solid transparent',
    backgroundColor: 'var(--bg-surface)',
    cursor: 'pointer',
    gap: '4px',
    transition: 'all 0.15s ease',
  },
  iconNameText: {
    fontSize: '0.625rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  roleOptionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  roleOptionCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  roleOptionCardActive: {
    borderColor: 'var(--primary)',
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
  },
  roleOptionSub: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '3px',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
  },
  modalCancelBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalSaveBtn: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
};
