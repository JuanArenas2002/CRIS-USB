/** Textos legibles para los códigos del backend: la interfaz no muestra códigos internos. */

const label = (map: Record<string, string>) => (code: string | null | undefined) =>
  code ? (map[code] ?? code) : '—';

export const userStatusLabel = label({
  active: 'Activa',
  invited: 'Invitación pendiente',
  inactive: 'Inactiva',
  blocked: 'Bloqueada',
});

export const accountTypeLabel = label({ institutional: 'Institucional', external: 'Externa' });

export const methodLabel = label({ password: 'Correo y contraseña', microsoft: 'Microsoft institucional' });

export const resultLabel = label({ success: 'Correcto', failure: 'Fallido', denied: 'Denegado' });

export const moduleLabel = label({
  news: 'Noticias',
  iam: 'Usuarios y accesos',
  organization: 'Dependencias',
});

/** Acciones del historial editorial. */
export const newsActionLabel = label({
  create: 'Creó la noticia',
  update: 'Editó la noticia',
  submit: 'Envió a revisión',
  approve: 'Aprobó',
  reject: 'Rechazó',
  publish: 'Publicó',
  schedule: 'Programó la publicación',
  archive: 'Archivó',
});

/** Eventos de auditoría. */
export const auditEventLabel = label({
  'auth.login': 'Inicio de sesión',
  'auth.login.rate_limited': 'Demasiados intentos de inicio de sesión',
  'auth.logout': 'Cierre de sesión',
  'auth.account.locked': 'Cuenta bloqueada temporalmente',
  'auth.session.refresh': 'Renovación de sesión',
  'auth.session.reuse_detected': 'Posible robo de sesión: se cerraron todas',
  'auth.session.revoked': 'Sesión cerrada por un administrador',
  'auth.password.forgot': 'Solicitud de recuperación de contraseña',
  'auth.password.reset': 'Contraseña restablecida',
  'auth.password.change': 'Cambio de contraseña',
  'auth.register': 'Activación de cuenta invitada',
  'auth.email.verify': 'Verificación de correo',
  'auth.identity.linked': 'Cuenta de Microsoft vinculada',
  'auth.identity.unlinked': 'Cuenta de Microsoft desvinculada',
  'auth.identity.link_requested': 'Solicitud de vinculación con Microsoft',
  'iam.bootstrap.admin': 'Creación del administrador inicial',
  'iam.user.invited': 'Usuario invitado',
  'iam.user.invitation_resent': 'Invitación reenviada',
  'iam.user.updated': 'Datos de usuario modificados',
  'iam.user.activate': 'Cuenta activada',
  'iam.user.deactivate': 'Cuenta desactivada',
  'iam.user.block': 'Cuenta bloqueada',
  'iam.user.unblock': 'Cuenta desbloqueada',
  'iam.user.unlocked': 'Bloqueo temporal retirado',
  'iam.user.deleted': 'Usuario eliminado',
  'iam.user.change': 'Intento de administrar una cuenta con más privilegios',
  'iam.role.assigned': 'Rol asignado',
  'iam.role.assign': 'Intento de asignar un rol sin autoridad',
  'iam.role.revoked': 'Rol revocado',
  'iam.role.created': 'Rol creado',
  'iam.role.updated': 'Rol modificado',
  'iam.role.permissions_updated': 'Permisos de un rol modificados',
  'iam.role.deleted': 'Rol eliminado',
  'iam.permission.created': 'Permiso registrado',
  'iam.permission.updated': 'Permiso modificado',
});

/** Prefijos útiles para filtrar la auditoría. */
export const AUDIT_FILTERS = [
  { value: 'auth.login', label: 'Inicios de sesión' },
  { value: 'auth.password', label: 'Contraseñas' },
  { value: 'auth.session', label: 'Sesiones' },
  { value: 'auth.identity', label: 'Cuentas de Microsoft' },
  { value: 'iam.user', label: 'Usuarios' },
  { value: 'iam.role', label: 'Roles y asignaciones' },
  { value: 'iam.permission', label: 'Permisos' },
];
