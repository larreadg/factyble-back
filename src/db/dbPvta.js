const sql = require('mssql/msnodesqlv8');

// Conexión a la base MSSQL de PVTA (sistema PDV de terceros de El Halcón) mediante el driver nativo
// `msnodesqlv8` + Windows Authentication (Trusted Connection: usa la identidad de la sesión Windows
// que corre el proceso Node, sin usuario/clave). Por eso este módulo SÓLO funciona on-prem/Windows con
// el `ODBC Driver 17 for SQL Server` instalado — NO en Docker/Linux.
//
// Sólo se usa en el deployment on-prem/Windows (endpoint /procesar-factura y cron de innominadas). Es de
// sólo lectura sobre las vistas FACTYBLE_* (más el UPDATE del semáforo FACTYBLE_SIFEN_OUTBOX); nunca toca
// tablas propias de PVTA. Todas las queries deben parametrizarse con request.input() — jamás interpolar
// ruc/fecha en el texto SQL.

function construirConnectionString() {
  const server = process.env.PVTA_DB_INSTANCE
    ? `${process.env.PVTA_DB_SERVER || 'localhost'}\\${process.env.PVTA_DB_INSTANCE}`
    : (process.env.PVTA_DB_SERVER || 'localhost');
  const driver = process.env.PVTA_DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
  const trustCert = process.env.PVTA_DB_TRUST_SERVER_CERT === 'true' ? 'yes' : 'no';

  return (
    `Driver={${driver}};` +
    `Server=${server};` +
    `Database=${process.env.PVTA_DB_DATABASE || 'PVTA'};` +
    `Trusted_Connection=yes;` +
    `TrustServerCertificate=${trustCert};`
  );
}

let poolPromise;

// Pool reutilizable (patrón de src/db esperado por el resto del código). Si la conexión inicial falla,
// se limpia la promesa para que el próximo request reintente en vez de quedar cacheado el rechazo.
function getPool() {
  if (!poolPromise) {
    poolPromise = sql
      .connect({
        connectionString: construirConnectionString(),
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      })
      .catch((err) => {
        poolPromise = undefined;
        throw err;
      });
  }
  return poolPromise;
}

async function close() {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = undefined;
  }
}

module.exports = { sql, getPool, close };
