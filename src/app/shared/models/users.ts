import { Quiz } from './quiz';

export class Address {
    street1: string;
    street2: string;
    street3: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

export class Admin {
    id: string;
    user: User;
}

export class Student {
    id: string;
    user: User
    quizzes: Quiz[];
}

export class User {
    id: string;
    fname: string;
    lname: string;
    email: string;
    phone: string;
    address: Address;
    uname: string;
    pass: string;
    confirmPass: string;
    type: string;
    quizzes?: Quiz[];
    token?: string; // JWT token for authentication
    createdAt: Date;
    updatedAt: Date;
}
