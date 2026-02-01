Data Model Documentation - Zefa Finance
This document describes the data model for the Zefa Finance application (MVP Phase), including entity descriptions, field definitions, relationships, and an entity-relationship diagram (ERD).

Model Descriptions
1. User
Represents a registered user in the system who has access to their own financial dashboard.

Fields:

id: Unique universal identifier (UUID) for the user (Primary Key).

email: Unique email address for login authentication (max 255 characters).

hashed_password: Securely hashed password string (BCrypt). Plain text passwords are never stored.

full_name: User's full name (optional, max 100 characters).

created_at: Timestamp of account creation.

last_login_at: Timestamp of the last successful authentication.

Validation Rules:

Email is required, must be unique across the system, and follow valid email format.

Password (input) must be at least 8 characters long before hashing.

The ID is auto-generated (UUID v4) upon creation.

Relationships:

transactions: One-to-many relationship with the Transaction model (A user has many transactions).

2. Transaction
Represents a financial movement (income or expense) recorded by a user.

Fields:

id: Unique identifier for the transaction (Primary Key).

user_id: Reference to the user who owns this transaction (Foreign Key).

amount: Monetary value of the transaction. Stored with decimal precision (Numeric/Decimal) to avoid floating-point errors.

type: The type of movement. Enum: INCOME or EXPENSE.

category: Grouping category (e.g., "Food", "Transport"). Stored as a string for MVP flexibility.

description: Detailed description or notes about the transaction (optional, max 255 characters).

occurred_at: The actual date/time when the transaction took place.

created_at: Timestamp when the record was inserted into the system (Audit).

Validation Rules:

amount must always be a positive value (the sign is determined by the type field).

category is required to ensure consistency in dashboard reports.

If occurred_at is not provided, it defaults to the current server time.

Deletion of a User must trigger a cascade deletion of their Transaction records.

Relationships:

user: Many-to-one relationship with the User model.

Entity-Relationship Diagram (ERD)
The diagram below illustrates the entities and their direct relationships within the PostgreSQL database.

Snippet de código
erDiagram
    User ||--o{ Transaction : "records"

    User {
        uuid id PK
        string email UK
        string hashed_password
        string full_name
        timestamp created_at
        timestamp last_login_at
    }

    Transaction {
        uuid id PK
        uuid user_id FK
        decimal amount
        enum type "INCOME, EXPENSE"
        string category
        string description
        timestamp occurred_at
        timestamp created_at
    }
Key Design Principles
Referential Integrity: Foreign Key constraints (user_id) strictly enforce that no transaction can exist without an associated user (Orphan prevention).

Monetary Precision: The amount field uses exact numeric types (Decimal) instead of approximate floating-point types to guarantee financial accuracy.

Data Isolation (Multi-tenancy): The model is designed for Logical Multi-tenancy, where every query must filter by the authenticated user_id.

Auditability: The distinction between occurred_at (business date) and created_at (system date) allows for accurate historical tracking.

Simplicity (MVP Focus): Categories are currently implemented as strings rather than a separate normalized table. This reduces complexity for the initial release while allowing for future refactoring (e.g., User-defined categories).

Notes
All id fields use UUID v4 to ensure global uniqueness and prevent resource enumeration attacks.

The type field is implemented as a PostgreSQL ENUM or a String with strict application-level validation.

Indexes should be created on transactions(user_id, occurred_at) to optimize dashboard query performance.