package db

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/metakgp/iqps/backend/pkg/config"
)

var (
	database *pgxpool.Pool
	mu       sync.Mutex
)

const init_db = `CREATE TABLE IF NOT EXISTS iqps (
    id integer primary key generated always as identity,
    course_code TEXT NOT NULL DEFAULT '',
    course_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    exam TEXT CHECK (exam IN ('midsem', 'endsem') OR exam = ''),
    filelink TEXT NOT NULL,
    from_library BOOLEAN DEFAULT FALSE,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approve_status BOOLEAN DEFAULT FALSE,
		fts_course_details tsvector GENERATED ALWAYS AS (to_tsvector('english', course_code || ' ' || course_name)) stored
);

CREATE INDEX IF NOT EXISTS iqps_fts ON iqps USING gin (fts_course_details);

create index IF NOT EXISTS idx_course_name_trgm on iqps using gin (course_name gin_trgm_ops);

`

func InitDB() *pgxpool.Pool {
	var err error
	dbConfig := config.Get().DB
	psqlconn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", dbConfig.Host, dbConfig.Port, dbConfig.Username, dbConfig.Password, dbConfig.DBname)
	// database, err = sql.Open("postgres", psqlconn)
	database, err = pgxpool.New(context.Background(), psqlconn)
	if err != nil {
		panic("Invalid Database connection string")
	}

	err = database.Ping(context.Background())
	if err != nil {
		panic("Database did not respond to ping")
	}
	fmt.Println("Database connected")
	_, err = database.Exec(context.Background(), init_db)
	if err != nil {
		log.Fatal("Error initializting database: ", err.Error())
	}

	config.Get().Logger.Info("Successfully connected to database")
	return database
}

func GetDB() *pgxpool.Pool {
	if database == nil {
		mu.Lock()
		defer mu.Unlock()
		if database == nil {
			database = InitDB()
		}
	}
	return database
}