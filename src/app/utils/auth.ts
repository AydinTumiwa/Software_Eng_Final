import { User } from '../data/mockData';

interface UserCredentials {
  email: string;
  password: string;
}

// Demo users with credentials
const demoUsersWithCredentials: (User & { password: string })[] = [
  {
    id: "1",
    name: "Arry",
    email: "arry@university.edu",
    password: "12345678",
    role: "admin",
    department: "Computer Science",
  },
  {
    id: "2",
    name: "Jesse Pinkman",
    email: "jesse@university.edu",
    password: "12345678",
    role: "student",
    department: "Computer Science",
  },
  {
    id: "3",
    name: "Prof. Panji",
    email: "panji@university.edu",
    password: "12345678",
    role: "lecturer",
    department: "Engineering",
  },
];

const CURRENT_USER_KEY = 'roomify_current_user';

export const authService = {
  login: (credentials: UserCredentials): User | null => {
    const user = demoUsersWithCredentials.find(
      u => u.email === credentials.email && u.password === credentials.password
    );

    if (user) {
      const { password, ...userWithoutPassword } = user;
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
      return userWithoutPassword;
    }

    return null;
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as User;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  isAuthenticated: (): boolean => {
    return authService.getCurrentUser() !== null;
  },

  getDemoUsers: () => {
    return demoUsersWithCredentials.map(({ password, ...user }) => user);
  },
};
